// Why this exists: Claude's native vision content blocks accept PDFs and images
// only — not .xlsx/.xls workbooks. To let the extraction agent read spreadsheet
// uploads we serialize each worksheet to a compact text table the model can read
// as a normal `text` block. We deliberately preserve coordinates (sheet name,
// spreadsheet row numbers, column letters A/B/C…) so the model can cite exact
// cells like 'B4' or ranges like 'C4:N4' in the source_sheet / source_cell
// provenance fields of propose_extraction.

import ExcelJS from "exceljs";

// Keep the serialized text well under the model's context budget. Spreadsheets
// can be huge; we stop appending once we approach this and emit a truncation
// note rather than silently dropping data.
const MAX_CHARS = 120_000;

const TRUNCATION_NOTE = (omitted: string) =>
  `> [truncated: ${omitted} omitted to fit size limit]`;

// Convert a 1-based column index to its spreadsheet letter (1 -> A, 27 -> AA).
function columnLetter(index: number): string {
  let n = index;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Render a single ExcelJS cell value to a plain string. Formula cells arrive as
// { formula, result } — we prefer the computed result and fall back to the
// formula text when the workbook was never recalculated. Rich text, dates,
// hyperlinks and errors are flattened to something readable.
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    // Formula cell: { formula, result } (result may itself be an error object).
    if ("formula" in v || "sharedFormula" in v) {
      if (v.result !== null && v.result !== undefined) {
        if (typeof v.result === "object" && v.result !== null && "error" in (v.result as object)) {
          return String((v.result as Record<string, unknown>).error);
        }
        return cellToString(v.result);
      }
      const f = v.formula ?? v.sharedFormula;
      return f ? `=${String(f)}` : "";
    }
    // Hyperlink cell: { text, hyperlink }.
    if ("text" in v) return cellToString(v.text);
    // Rich text: { richText: [{ text }, …] }.
    if ("richText" in v && Array.isArray(v.richText)) {
      return (v.richText as Array<{ text?: string }>).map((r) => r.text ?? "").join("");
    }
    // Error cell: { error }.
    if ("error" in v) return String(v.error);
  }
  return String(value);
}

// Escape pipes/newlines so a cell can't break the table layout.
function escapeCell(s: string): string {
  return s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

// Minimal CSV parser: handles quoted fields, escaped quotes (""), embedded
// commas/newlines, and CRLF or LF line endings. No new dependency.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  // Strip a leading UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // Consume \r\n or lone \r as a single line break.
      if (text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush the trailing field/row (skip a spurious empty row from a final newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// A sheet abstracted to rows-of-strings, each tagged with its real spreadsheet
// row number (1-based) so provenance survives blank rows / header offsets.
interface SheetData {
  name: string;
  // [spreadsheetRowNumber, cells[]]
  rows: Array<[number, string[]]>;
  colCount: number;
}

function workbookToSheets(wb: ExcelJS.Workbook): SheetData[] {
  const sheets: SheetData[] = [];
  wb.eachSheet((ws) => {
    const rows: Array<[number, string[]]> = [];
    let colCount = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: string[] = [];
      let lastNonEmpty = 0;
      // row.eachCell with includeEmpty keeps column alignment intact.
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const s = cellToString(cell.value);
        cells[colNumber - 1] = s;
        if (s !== "") lastNonEmpty = colNumber;
      });
      const trimmed = cells.slice(0, lastNonEmpty);
      colCount = Math.max(colCount, trimmed.length);
      rows.push([rowNumber, trimmed]);
    });
    sheets.push({ name: ws.name, rows, colCount });
  });
  return sheets;
}

function csvToSheets(text: string, filename: string): SheetData[] {
  const parsed = parseCsv(text);
  let colCount = 0;
  const rows: Array<[number, string[]]> = parsed.map((cells, idx) => {
    let lastNonEmpty = 0;
    for (let c = 0; c < cells.length; c++) if (cells[c].trim() !== "") lastNonEmpty = c + 1;
    const trimmed = cells.slice(0, lastNonEmpty);
    colCount = Math.max(colCount, trimmed.length);
    // CSV rows are 1-based to match how a user sees them in a spreadsheet app.
    return [idx + 1, trimmed];
  });
  return [{ name: filename || "CSV", rows, colCount }];
}

// Serialize sheets to a size-capped, coordinate-preserving text representation.
function serializeSheets(sheets: SheetData[]): string {
  const out: string[] = [];
  let size = 0;
  let truncated = false;

  // Append a line if it fits; returns false if it would exceed the cap.
  const append = (line: string): boolean => {
    const cost = line.length + 1; // +1 for the join newline
    if (size + cost > MAX_CHARS) return false;
    out.push(line);
    size += cost;
    return true;
  };

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const header = `## Sheet: ${sheet.name}`;
    if (!append("") || !append(header)) {
      truncated = true;
      const remainingSheets = sheets.length - s;
      out.push(TRUNCATION_NOTE(`${remainingSheets} more sheet(s)`));
      break;
    }

    // Column-letter header row so the model can map a column to A/B/C… and cite
    // e.g. 'B4'. The leading 'row' label column holds the spreadsheet row number.
    const letters = ["row"];
    for (let c = 1; c <= Math.max(sheet.colCount, 1); c++) letters.push(columnLetter(c));
    append(`| ${letters.join(" | ")} |`);

    let stoppedAt = -1;
    for (let r = 0; r < sheet.rows.length; r++) {
      const [rowNum, cells] = sheet.rows[r];
      const padded: string[] = [String(rowNum)];
      for (let c = 0; c < sheet.colCount; c++) padded.push(escapeCell(cells[c] ?? ""));
      const line = `| ${padded.join(" | ")} |`;
      if (!append(line)) {
        stoppedAt = r;
        break;
      }
    }

    if (stoppedAt >= 0) {
      truncated = true;
      const remainingRows = sheet.rows.length - stoppedAt;
      const remainingSheets = sheets.length - s - 1;
      const parts: string[] = [];
      if (remainingRows > 0) parts.push(`${remainingRows} more row(s) in sheet "${sheet.name}"`);
      if (remainingSheets > 0) parts.push(`${remainingSheets} more sheet(s)`);
      out.push(TRUNCATION_NOTE(parts.join(", ")));
      break;
    }
  }

  let text = out.join("\n").trim();
  if (truncated && !text.includes("[truncated:")) {
    text += `\n${TRUNCATION_NOTE("data")}`;
  }
  return text;
}

const SPREADSHEET_OPENXML =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SPREADSHEET_XLS = "application/vnd.ms-excel";

export async function spreadsheetToText(
  bytes: Buffer,
  mime: string,
  filename: string,
): Promise<string> {
  const isCsv = mime === "text/csv" || /\.csv$/i.test(filename);

  let sheets: SheetData[];
  if (isCsv) {
    sheets = csvToSheets(bytes.toString("utf8"), filename);
  } else if (mime === SPREADSHEET_OPENXML || mime === SPREADSHEET_XLS || /\.xlsx?$/i.test(filename)) {
    const wb = new ExcelJS.Workbook();
    // ExcelJS types want an ArrayBuffer; a Node Buffer works at runtime.
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    sheets = workbookToSheets(wb);
  } else {
    throw new Error(`Unsupported spreadsheet mime type "${mime}" for "${filename}".`);
  }

  if (!sheets.length || sheets.every((s) => s.rows.length === 0)) {
    return `## Sheet: ${filename}\n> [no rows found]`;
  }
  return serializeSheets(sheets);
}

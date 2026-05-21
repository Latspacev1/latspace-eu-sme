// VSME export — JSZip-based direct-XML patcher.
//
// The EFRAG VSME Digital Template (v1.2.0) is a complex workbook: array
// formulas, XLOOKUP/_xlfn.* functions, custom XBRL feature-property bags,
// printer-setting bins, drawings, defined names, conditional formatting.
// ExcelJS can't round-trip the whole thing without dropping or mangling
// parts (Excel then surfaces "Repaired Records" warnings on open).
//
// Rather than fight that, this exporter does the minimal possible work: it
// unzips the template, edits ONLY the cells we have bindings for by patching
// the per-sheet XML in place, and re-zips. Everything else (styles, formulas,
// defined names, drawings, conditional formatting, XBRL parts) is preserved
// byte-for-byte, so the resulting file opens cleanly in Excel.

import { bindings, type Binding, type FieldBinding, type TableBinding } from "./map";
import { VSME_ANSWERS_KEY, readAnswers } from "@/lib/reporting/storage";

const TEMPLATE_URL = "/vsme-template.xlsx";

export async function exportVsmeFilled(): Promise<void> {
  const [JSZipMod, FileSaverMod] = await Promise.all([
    import("jszip"),
    import("file-saver"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JSZip = (JSZipMod as any).default ?? (JSZipMod as any);
  const saveAs =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (FileSaverMod as any).saveAs ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (FileSaverMod as any).default?.saveAs ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (FileSaverMod as any).default;
  if (typeof JSZip !== "function") throw new Error("jszip not found");
  if (typeof saveAs !== "function") throw new Error("file-saver saveAs not found");

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`Failed to load VSME template: HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zip = await (JSZip as any).loadAsync(buffer);

  // Resolve sheet name → XML file path. Read workbook.xml + workbook.xml.rels.
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const sheetFileMap = resolveSheetFileMap(workbookXml, relsXml);

  const answers = readAnswers(VSME_ANSWERS_KEY);

  // Group bindings by sheet so we only load/patch each sheet XML once.
  const bySheet = new Map<string, Binding[]>();
  for (const b of bindings) {
    const arr = bySheet.get(b.sheet) ?? [];
    arr.push(b);
    bySheet.set(b.sheet, arr);
  }

  for (const [sheetName, sheetBindings] of bySheet) {
    const path = sheetFileMap.get(sheetName);
    if (!path) {
      console.warn(`[vsme-export] sheet not found in workbook: "${sheetName}"`);
      continue;
    }
    const sheetXml = await zip.file(path)!.async("string");

    // Collect every (cell, value) pair we need to write to this sheet.
    const writes: Array<{ cell: string; value: CellValue }> = [];
    for (const b of sheetBindings) {
      if (b.kind === "field") {
        const w = fieldWrite(b, answers);
        if (w) writes.push(w);
      } else {
        writes.push(...tableWrites(b, answers));
      }
    }

    if (writes.length === 0) continue;

    const patched = patchSheetXml(sheetXml, writes);
    zip.file(path, patched);
  }

  const out = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(out, `VSME-Report-${stamp}.xlsx`);
}

// ─── Answer access ─────────────────────────────────────────────────────────

type Answers = ReturnType<typeof readAnswers>;

function fieldWrite(b: FieldBinding, answers: Answers): { cell: string; value: CellValue } | null {
  const a = answers[b.questionId];
  if (!a) return null;
  const raw = (a.values as Record<string, unknown>)[b.fieldId];
  if (raw === undefined || raw === null || raw === "") return null;
  return { cell: b.cell, value: coerce(raw, b.transform) };
}

function tableWrites(b: TableBinding, answers: Answers): Array<{ cell: string; value: CellValue }> {
  const out: Array<{ cell: string; value: CellValue }> = [];
  const a = answers[b.questionId];
  if (!a) return out;
  const rows = (a.rows as Record<string, unknown>[]) ?? [];
  rows.slice(0, b.maxRows).forEach((row, i) => {
    for (const [fieldId, bind] of Object.entries(b.columns)) {
      const v = row[fieldId];
      if (v === undefined || v === null || v === "") continue;
      const rowNum = b.anchorRow + i * b.rowStride;
      out.push({ cell: `${bind.col}${rowNum}`, value: coerce(v, bind.transform) });
    }
  });
  return out;
}

// ─── Value coercion ────────────────────────────────────────────────────────

type CellValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "boolean"; value: boolean };

function coerce(v: unknown, transform?: FieldBinding["transform"]): CellValue {
  switch (transform) {
    case "boolean":
      if (typeof v === "boolean") return { kind: "boolean", value: v };
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "yes") return { kind: "boolean", value: true };
        if (s === "false" || s === "no") return { kind: "boolean", value: false };
      }
      return toCellValue(v);
    case "yesNoFromBool":
      return { kind: "string", value: v ? "Yes" : "No" };
    case "yesNoString":
      if (v === true) return { kind: "string", value: "YES" };
      if (v === false) return { kind: "string", value: "NO" };
      return toCellValue(v);
    case "year":
      if (typeof v === "string") {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) return { kind: "number", value: d.getFullYear() };
        const m = v.match(/(\d{4})/);
        if (m) return { kind: "number", value: Number(m[1]) };
      }
      if (typeof v === "number") return { kind: "number", value: v };
      return toCellValue(v);
    case "dateFromIso":
      if (typeof v === "string" && v) {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) {
          // Excel serial date number: days since 1899-12-30.
          const epoch = Date.UTC(1899, 11, 30);
          const days = (d.getTime() - epoch) / 86400000;
          return { kind: "number", value: days };
        }
      }
      return toCellValue(v);
    default:
      return toCellValue(v);
  }
}

function toCellValue(v: unknown): CellValue {
  if (typeof v === "number") return { kind: "number", value: v };
  if (typeof v === "boolean") return { kind: "boolean", value: v };
  return { kind: "string", value: String(v) };
}

// ─── Sheet name → file path resolution ─────────────────────────────────────

function resolveSheetFileMap(workbookXml: string, relsXml: string): Map<string, string> {
  // r:id → Target  (e.g. rId4 → "worksheets/sheet4.xml")
  const relTarget = new Map<string, string>();
  const relRe = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g;
  for (const m of workbookXml === "" ? [] : Array.from(relsXml.matchAll(relRe))) {
    relTarget.set(m[1], m[2]);
  }

  // sheet name → r:id, then derive full path "xl/<target>"
  const result = new Map<string, string>();
  const sheetRe = /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g;
  for (const m of Array.from(workbookXml.matchAll(sheetRe))) {
    const name = decodeXmlAttr(m[1]);
    const target = relTarget.get(m[2]);
    if (!target) continue;
    // workbook.xml lives at xl/workbook.xml; sheet target is relative → "xl/<target>"
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    result.set(name, path);
  }
  return result;
}

function decodeXmlAttr(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── XML patching ──────────────────────────────────────────────────────────

interface ParsedCellRef {
  col: string; // letters
  row: number; // 1-based
}

function parseCellRef(ref: string): ParsedCellRef {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`bad cell ref: ${ref}`);
  return { col: m[1], row: Number(m[2]) };
}

function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function renderCellXml(ref: string, existingStyle: string | null, value: CellValue): string {
  const sAttr = existingStyle ? ` s="${existingStyle}"` : "";
  switch (value.kind) {
    case "number":
      return `<c r="${ref}"${sAttr}><v>${value.value}</v></c>`;
    case "boolean":
      return `<c r="${ref}"${sAttr} t="b"><v>${value.value ? 1 : 0}</v></c>`;
    case "string":
      // Use inline strings so we don't have to maintain sharedStrings.xml.
      // Excel handles inline strings just as well.
      return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${encodeXmlText(
        value.value,
      )}</t></is></c>`;
  }
}

function patchSheetXml(xml: string, writes: Array<{ cell: string; value: CellValue }>): string {
  // Group writes by row.
  const byRow = new Map<number, Array<{ cell: string; value: CellValue }>>();
  for (const w of writes) {
    const { row } = parseCellRef(w.cell);
    const arr = byRow.get(row) ?? [];
    arr.push(w);
    byRow.set(row, arr);
  }

  // For each row that has writes: replace the row in-place if it exists,
  // otherwise insert a fresh <row> at the right ordinal position.
  let result = xml;
  for (const [rowNum, rowWrites] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    // Build the pattern via String.raw so the `\b` and `\s` escapes survive
    // template-string parsing and reach the RegExp engine intact.
    const rowRe = new RegExp(
      String.raw`<row\b[^>]*\br="` + rowNum + String.raw`"[^>]*>([\s\S]*?)</row>`,
    );
    const rowMatch = rowRe.exec(result);
    if (rowMatch) {
      // Existing row — splice each write into the row body.
      const rowOpen = rowMatch[0].slice(0, rowMatch[0].indexOf(">") + 1);
      let body = rowMatch[1];
      for (const w of rowWrites) {
        body = upsertCellInRow(body, w.cell, w.value);
      }
      const newRow = `${rowOpen}${body}</row>`;
      result = result.slice(0, rowMatch.index) + newRow + result.slice(rowMatch.index + rowMatch[0].length);
    } else {
      // Row doesn't exist — synthesise a minimal one and insert before the
      // next-greater row, or at the end of <sheetData> if there is none.
      const newRow = `<row r="${rowNum}">${rowWrites
        .map((w) => renderCellXml(w.cell, null, w.value))
        .join("")}</row>`;
      result = insertRow(result, rowNum, newRow);
    }
  }
  return result;
}

function upsertCellInRow(rowBody: string, cellRef: string, value: CellValue): string {
  // Find existing <c r="cellRef" .../> or <c r="cellRef" ...>...</c>
  const cellRe = new RegExp(
    String.raw`<c\b[^>]*\br="` + cellRef + String.raw`"(?:[^>]*\/>|[^>]*>[\s\S]*?</c>)`,
  );
  const cellMatch = cellRe.exec(rowBody);
  if (cellMatch) {
    // Preserve the existing s="..." attribute (style) if present.
    const styleMatch = /\bs="([^"]+)"/.exec(cellMatch[0]);
    const existingStyle = styleMatch ? styleMatch[1] : null;
    const replacement = renderCellXml(cellRef, existingStyle, value);
    return rowBody.slice(0, cellMatch.index) + replacement + rowBody.slice(cellMatch.index + cellMatch[0].length);
  }
  // Cell doesn't exist in this row — insert it in column-order so Excel
  // is happy with sorted cell refs.
  const target = parseCellRef(cellRef);
  const targetIdx = colToIndex(target.col);
  const cellListRe = /<c\b[^>]*\br="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g;
  let insertAt = rowBody.length;
  for (const m of Array.from(rowBody.matchAll(cellListRe))) {
    const idx = colToIndex(m[1]);
    if (idx > targetIdx) {
      insertAt = m.index!;
      break;
    }
  }
  const inserted = renderCellXml(cellRef, null, value);
  return rowBody.slice(0, insertAt) + inserted + rowBody.slice(insertAt);
}

function insertRow(sheetXml: string, rowNum: number, rowXml: string): string {
  // Find the first existing row with r > rowNum and insert before it; else
  // append before </sheetData>.
  const rowsRe = /<row\b[^>]*\br="(\d+)"/g;
  for (const m of Array.from(sheetXml.matchAll(rowsRe))) {
    if (Number(m[1]) > rowNum) {
      return sheetXml.slice(0, m.index!) + rowXml + sheetXml.slice(m.index!);
    }
  }
  // Otherwise insert before </sheetData>
  return sheetXml.replace("</sheetData>", `${rowXml}</sheetData>`);
}

/**
 * Lightweight markdown-to-JSX renderer used in AI chat bubbles.
 * Handles paragraphs, bullet lists, headings, **bold**, and `inline code`.
 * No react-markdown dependency.
 */

export function InlineFormatted({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="bg-gray-100 px-1 rounded text-xs font-mono">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") || /^\|?[\s-:|]+\|?$/.test(t);
}

function isSeparatorLine(line: string): boolean {
  return /^\|?[\s-:|]+\|?$/.test(line.trim());
}

function parseCells(line: string): string[] {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function mergeTableLines(content: string): string {
  const lines = content.split("\n");
  const merged: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isTableLine(lines[i]) && lines[i].trim() !== "") {
      const tableLines: string[] = [lines[i]];
      i++;
      while (i < lines.length) {
        if (lines[i].trim() === "" && i + 1 < lines.length && isTableLine(lines[i + 1])) {
          i++;
          continue;
        }
        if (isTableLine(lines[i]) && lines[i].trim() !== "") {
          tableLines.push(lines[i]);
          i++;
          continue;
        }
        break;
      }
      merged.push(tableLines.join("\n"));
    } else {
      merged.push(lines[i]);
      i++;
    }
  }

  return merged.join("\n");
}

function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;

  const headers = parseCells(lines[0]);
  if (!isSeparatorLine(lines[1])) return null;

  const rows = lines
    .slice(2)
    .filter((l) => l.trim() !== "" && !isSeparatorLine(l))
    .map(parseCells);
  return { headers, rows };
}

function isTableBlock(lines: string[]): boolean {
  return lines.length >= 2 && lines[0].includes("|") && isSeparatorLine(lines[1]);
}

function MarkdownTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            {headers.map((h, i) => (
              <th key={i} className="px-2 py-1.5 text-left font-semibold text-gray-700">
                <InlineFormatted text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 text-gray-600">
                  <InlineFormatted text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MessageContent({ content }: { content: string }) {
  const normalized = mergeTableLines(content);
  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => {
        const lines = para.split("\n");

        if (isTableBlock(lines)) {
          const table = parseTable(lines);
          if (table) return <MarkdownTable key={i} {...table} />;
        }

        const isList = lines.every(
          (l) => l.trim().startsWith("- ") || l.trim().startsWith("* "),
        );

        if (isList) {
          return (
            <ul key={i} className="list-disc pl-4 space-y-0.5">
              {lines.map((line, j) => (
                <li key={j}>
                  <InlineFormatted text={line.replace(/^[-*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }

        if (para.startsWith("### ")) {
          return (
            <p key={i} className="font-semibold text-gray-900">
              <InlineFormatted text={para.slice(4)} />
            </p>
          );
        }
        if (para.startsWith("## ")) {
          return (
            <p key={i} className="font-bold text-gray-900">
              <InlineFormatted text={para.slice(3)} />
            </p>
          );
        }

        return (
          <p key={i}>
            {lines.map((line, j) => (
              <span key={j}>
                <InlineFormatted text={line} />
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function StreamingCursor() {
  return (
    <span className="inline-block w-1.5 h-4 bg-primary animate-pulse rounded-sm ml-0.5 align-middle" />
  );
}

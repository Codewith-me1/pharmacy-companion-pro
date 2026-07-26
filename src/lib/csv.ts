// Minimal, dependency-free CSV parser: handles quoted fields (including embedded commas,
// newlines, and escaped "" quotes) without pulling in a library for something this small.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") pushField();
    else if (char === "\n") pushRow();
    else if (char === "\r") continue;
    else field += char;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// Parses a CSV into row objects keyed by the header row's exact cell text (trimmed) — callers
// remap these to their own field keys via a case-insensitive label match (see importColumns.ts
// usage in each page), since a hand-filled spreadsheet's header casing/spacing can't be relied on.
export function parseCsvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? "").trim();
      });
      return obj;
    });
}

export interface CsvTemplateColumn {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
}

export function buildCsvTemplate(columns: CsvTemplateColumn[]): string {
  const header = columns.map((c) => escapeCsvField(c.required ? `${c.label} *` : c.label)).join(",");
  const example = columns.map((c) => escapeCsvField(c.example ?? "")).join(",");
  return `${header}\n${example}\n`;
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Remaps parsed CSV row objects (keyed by raw header text) onto a fixed set of field keys, by
// case-insensitive, trim/asterisk-tolerant match against each column's label — so it doesn't
// matter if a hand-edited template's header casing or the "required" marker got tweaked.
export function remapCsvRows(rawRows: Record<string, string>[], columns: CsvTemplateColumn[]): Record<string, string>[] {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s*\*\s*$/, "");
  const headerToKey = new Map(columns.map((c) => [normalize(c.label), c.key]));
  return rawRows.map((row) => {
    const obj: Record<string, string> = {};
    for (const [header, value] of Object.entries(row)) {
      const key = headerToKey.get(normalize(header));
      if (key) obj[key] = value;
    }
    return obj;
  });
}

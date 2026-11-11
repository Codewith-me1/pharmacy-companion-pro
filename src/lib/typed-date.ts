// Parsing for dates typed by hand (DD/MM/YYYY and friends) instead of picked from a calendar.
// Everything here works on local calendar fields only — never `new Date(string)` — so a typed
// "01/02/2026" can't be silently read as January 2nd (US order) or shifted a day by a UTC offset.

export type TypedDateMode = "date" | "expiry";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function expandYear(raw: string) {
  const n = Number(raw);
  return raw.length === 2 ? 2000 + n : n;
}

function toIso(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return null;
  if (day > lastDayOfMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Turns typed text into a YYYY-MM-DD string, or null when it isn't a complete, real date.
 *
 * Accepted (any of / - . or space as separator):
 *   DD/MM/YYYY, DD/MM/YY, DDMMYYYY, DDMMYY, YYYY-MM-DD, and DD/MM (current year) in date mode.
 * Expiry mode additionally accepts the month-only forms printed on medicine packs — MM/YY,
 * MM/YYYY, MMYY — which resolve to the last day of that month, the same convention the invoice
 * importer uses.
 */
export function parseTypedDate(input: string, mode: TypedDateMode = "date"): string | null {
  const text = input.trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // A trailing separator ("31/08/") means the user is still typing the next part.
  if (/[/\-.]$/.test(text)) return null;
  const parts = text.split(/[/\-. ]+/).filter(Boolean);
  if (parts.some((p) => !/^\d+$/.test(p))) return null;

  if (parts.length === 1) {
    const digits = parts[0];
    if (digits.length === 8)
      return toIso(Number(digits.slice(4)), Number(digits.slice(2, 4)), Number(digits.slice(0, 2)));
    if (digits.length === 6) {
      // DDMMYY for a full date; in expiry mode MMYYYY is the likelier reading of 6 digits.
      if (mode === "expiry" && Number(digits.slice(2)) >= 1900) {
        const month = Number(digits.slice(0, 2));
        const year = Number(digits.slice(2));
        return toIso(year, month, lastDayOfMonth(year, month));
      }
      return toIso(
        expandYear(digits.slice(4)),
        Number(digits.slice(2, 4)),
        Number(digits.slice(0, 2)),
      );
    }
    if (digits.length === 4 && mode === "expiry") {
      const month = Number(digits.slice(0, 2));
      const year = expandYear(digits.slice(2));
      return toIso(year, month, lastDayOfMonth(year, month));
    }
    return null;
  }

  if (parts.length === 2) {
    const [a, b] = parts;
    if (mode === "expiry" && (b.length === 2 || b.length === 4)) {
      const month = Number(a);
      const year = expandYear(b);
      if (month < 1 || month > 12) return null;
      return toIso(year, month, lastDayOfMonth(year, month));
    }
    if (mode === "date" && b.length <= 2) {
      return toIso(new Date().getFullYear(), Number(b), Number(a));
    }
    return null;
  }

  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length !== 2 && y.length !== 4) return null;
    return toIso(expandYear(y), Number(m), Number(d));
  }

  return null;
}

/**
 * Formats a stored value for display in a typed date field. In expiry mode an end-of-month date
 * is shown as MM/YYYY, matching how expiry is printed on the strip. Values that aren't ISO dates
 * (e.g. an invoice date exactly as the OCR read it) are run through the typed parser first, and
 * shown verbatim if even that fails, so the user can see and correct them.
 */
export function formatTypedDate(
  value: string | null | undefined,
  mode: TypedDateMode = "date",
): string {
  if (!value) return "";
  const iso = parseTypedDate(value, mode) ?? parseTypedDate(value.slice(0, 10), mode);
  if (!iso) return value;
  const [year, month, day] = iso.split("-").map(Number);
  if (mode === "expiry" && day === lastDayOfMonth(year, month)) return `${pad(month)}/${year}`;
  return `${pad(day)}/${pad(month)}/${year}`;
}

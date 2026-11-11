import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatTypedDate, parseTypedDate, type TypedDateMode } from "@/lib/typed-date";
import { cn } from "@/lib/utils";

// Drop-in replacement for <Input type="date">: the date is typed (DD/MM/YYYY, or MM/YY for
// expiry) instead of picked from a calendar. `value` and `onChange` speak the same YYYY-MM-DD
// strings the native date input did, so callers and the server don't change. While the text is
// incomplete or invalid, onChange reports "" — the field is highlighted, and any "required"
// check in the parent sees the date as missing rather than keeping a stale value.
export function DateInput({
  value,
  onChange,
  mode = "date",
  className,
  placeholder,
  id,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  mode?: TypedDateMode;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => formatTypedDate(value, mode));
  // The last value this field reported (or was given). Lets an outside change — a form reset, a
  // medicine picked that prefills the date — replace the text, without our own "" (incomplete)
  // reports bouncing back and wiping what the user is halfway through typing.
  const lastValue = useRef(value ?? "");

  useEffect(() => {
    const next = value ?? "";
    if (next !== lastValue.current) {
      lastValue.current = next;
      setText(formatTypedDate(next, mode));
    }
  }, [value, mode]);

  function report(next: string) {
    if (next !== lastValue.current) {
      lastValue.current = next;
      onChange(next);
    }
  }

  function handleChange(raw: string) {
    let next = raw;
    // Typing digits only: insert the separators as the user goes (31 → 31/, 31/08 → 31/08/).
    // Only when adding characters, so backspacing over a "/" isn't immediately undone. Expiry
    // mode stops after the first one, since MM/YY is complete there.
    if (raw.length > text.length) {
      if (/^\d{2}$/.test(raw)) next = `${raw}/`;
      else if (mode === "date" && /^\d{2}\/\d{2}$/.test(raw)) next = `${raw}/`;
    }
    setText(next);
    report(parseTypedDate(next, mode) ?? "");
  }

  function handleBlur() {
    const iso = parseTypedDate(text, mode);
    if (iso) setText(formatTypedDate(iso, mode));
  }

  const invalid = text.trim() !== "" && parseTypedDate(text, mode) === null;

  return (
    <Input
      id={id}
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder ?? (mode === "expiry" ? "MM/YY" : "DD/MM/YYYY")}
      value={text}
      aria-invalid={invalid || undefined}
      title={
        mode === "expiry"
          ? "Type MM/YY, MM/YYYY or DD/MM/YYYY"
          : "Type DD/MM/YYYY (DD/MM/YY also works)"
      }
      className={cn(invalid && "border-destructive focus-visible:ring-destructive", className)}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
    />
  );
}

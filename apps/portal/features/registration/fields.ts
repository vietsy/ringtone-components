/*
 * Reading the registration forms. A field is read as typed; a date is read as R1's date field sends it, day
 * first, and handed to the API as an ISO date.
 */

/** A form field's text, trimmed; an absent field is empty. */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A date as R1's date field sends it - day, month, year as people type it (3/10/2026, 03.10.2026, 03102026) -
 * or already an ISO date, as an ISO date; null when it is not a calendar date.
 */
export function readDate(value: string): string | null {
  const typed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typed);
  const dmy = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(typed) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(typed);
  const [year, month, day] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (year === undefined || month === undefined || day === undefined) return null;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

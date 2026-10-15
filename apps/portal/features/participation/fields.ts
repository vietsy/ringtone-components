/*
 * Reading the participation forms, on the server and in the browser alike, so nothing here imports the seam.
 * A field is read as typed; a date as R1's date field sends it, day first, and handed on as an ISO date; a
 * choice only when it is one of the register's own values, because an act's arguments come from the browser.
 */

/** A form field's text, trimmed; an absent field is empty. */
export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Every value sent under one name, in the form's order: a group of boxes, or a field repeated per row. */
export function every(form: FormData, name: string): string[] {
  return form.getAll(name).map((value) => (typeof value === "string" ? value.trim() : ""));
}

/** The value when it is one of `allowed`; null otherwise. */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** The values that are among `allowed`, once each, in the register's order. */
export function someOf<T extends string>(values: readonly string[], allowed: readonly T[]): T[] {
  return allowed.filter((option) => values.includes(option));
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

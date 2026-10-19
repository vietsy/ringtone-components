/*
 * Reading the Player console's forms. A field is read as typed. R1's date field sends a date as the reader typed it,
 * day first, and the API takes it as an ISO date; with a time it sends "2026-09-30T10:15+07:00" once both parts are
 * whole, which is passed on as it is.
 */

/** A form field's text, trimmed; an absent field is empty. */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** A date as typed (1/11/2026, 01.11.2026) or already ISO, as an ISO date; the text as typed when it is no calendar date. */
export function isoDate(value: string): string {
  const typed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typed);
  const dmy = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(typed);
  const [year, month, day] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (year === undefined || month === undefined || day === undefined) return typed;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return typed;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

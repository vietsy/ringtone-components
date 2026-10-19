/*
 * Reading the Player forms. A field is read as typed; a date as R1's date field sends it, day first, handed to the
 * API as an ISO date; a time as R1's time field sends it, hh:mm, with 24:00 for the end of a day.
 */

/** A form field's text, trimmed; an absent field is empty. */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** A date as typed (3/10/2026, 03.10.2026) or already ISO, as an ISO date; null when it is not a calendar date. */
export function readDate(value: string): string | null {
  const typed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typed);
  const dmy = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(typed);
  const [year, month, day] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (year === undefined || month === undefined || day === undefined) return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** A clock time as typed (9:30, 09:30, 0930), as hh:mm; 24:00 is kept as the end of the day; null when it is none. */
export function readTime(value: string): string | null {
  const match = /^(\d{1,2}):?(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return "24:00";
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

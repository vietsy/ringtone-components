/** A date as R1's date field sends it (day first, as typed) or as an ISO date: none when empty, unreadable when not a date. */
export function readDate(value: string): { iso: string | null; unreadable: boolean } {
  if (value === "") return { iso: null, unreadable: false };
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dmy = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(value) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  const [year, month, dayOf] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (year === undefined || month === undefined || dayOf === undefined) return { iso: null, unreadable: true };
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(dayOf)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(dayOf)) {
    return { iso: null, unreadable: true };
  }
  return { iso: `${year}-${month.padStart(2, "0")}-${dayOf.padStart(2, "0")}`, unreadable: false };
}

/** The ISO date R1's date field takes as its value, from what was typed or kept; empty when it is not a date. */
export const isoDate = (value: string): string => readDate(value.trim()).iso ?? "";

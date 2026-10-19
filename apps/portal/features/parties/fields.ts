import type { ChosenFile } from "@/lib/api/parties";

/*
 * Reading the party forms. A field is read as typed; a date is read as R1's date field sends it, day first, and
 * handed to the API as an ISO date; a file is the name, type and size the form kept for it.
 */

/** A form field's text, trimmed; an absent field is empty. */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Every value of a field that repeats: the acts ticked, for one. */
export function texts(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === "string" && value.trim() !== "");
}

/** Every field of a form as typed, for the page to put back after a refusal. */
export function typed(formData: FormData): Record<string, string | readonly string[]> {
  const values: Record<string, string | string[]> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string" || name.startsWith("$ACTION")) continue;
    const before = values[name];
    values[name] = before === undefined ? value : Array.isArray(before) ? [...before, value] : [before, value];
  }
  return values;
}

/**
 * A date as R1's date field sends it - day, month, year as people type it (3/10/2026, 03.10.2026, 03102026) - or
 * already an ISO date, as an ISO date; null when it is not a calendar date.
 */
export function readDate(value: string): string | null {
  const typedValue = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typedValue);
  const dmy = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(typedValue) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(typedValue);
  const [year, month, dayOfMonth] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (year === undefined || month === undefined || dayOfMonth === undefined) return null;
  const y = Number(year);
  const m = Number(month);
  const d = Number(dayOfMonth);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The file a form kept in its hidden fields, `<name>_name`, `_type` and `_size`; null when none was chosen. */
export function chosenFile(formData: FormData, name: string): ChosenFile | null {
  const fileName = text(formData, `${name}_name`);
  if (fileName === "") return null;
  return { name: fileName, type: text(formData, `${name}_type`), sizeBytes: Number(text(formData, `${name}_size`)) || 0 };
}

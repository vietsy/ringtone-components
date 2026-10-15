import type { ChosenFile, MandateForm, ScopeRow } from "@/lib/api/governance";

/*
 * Reading the governance forms. A field is read as typed; a date is read as R1's date field sends it, day first,
 * and handed to the API as an ISO date. The organisation is never read from a form: it is the session's.
 */

/** A row as Add a row starts it: nothing chosen, the repertoire `*` (all of it), as the board's rows are typed. */
export const EMPTY_ROW: ScopeRow = { rightType: "", repertoire: "*", territory: "" };

/** A form field's text, trimmed; an absent field is empty. */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A date as R1's date field sends it - day, month, year as people type it (1/10/2026, 01.10.2026, 01102026) - or
 * already an ISO date, as an ISO date; null when it is empty or not a calendar date.
 */
export function readDate(value: string): string | null {
  const typed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typed);
  const dmy = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(typed) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(typed);
  const [year, month, dayOfMonth] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (year === undefined || month === undefined || dayOfMonth === undefined) return null;
  const y = Number(year);
  const m = Number(month);
  const d = Number(dayOfMonth);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The file the form recorded: its name, type and size, as the browser reported them. Nothing else is sent. */
function readEvidence(formData: FormData): ChosenFile | null {
  const name = text(formData, "evidence_name");
  const size = Number(text(formData, "evidence_size"));
  if (name === "") return null;
  return { name, type: text(formData, "evidence_type"), sizeBytes: Number.isFinite(size) ? size : 0 };
}

/** The represented rights: the three fields of each row, in the order the rows stand. */
function readRows(formData: FormData): ScopeRow[] {
  const all = (name: string) => formData.getAll(name).map((value) => (typeof value === "string" ? value.trim() : ""));
  const rights = all("right_type");
  const repertoires = all("repertoire");
  const territories = all("territory");
  return rights.map((rightType, index) => ({ rightType, repertoire: repertoires[index] ?? "", territory: territories[index] ?? "" }));
}

/** SCR-GOV-14's form as entered. */
export function readMandateForm(formData: FormData): MandateForm {
  return {
    authority: text(formData, "granting_authority_id"),
    evidence: readEvidence(formData),
    rows: readRows(formData),
    from: readDate(text(formData, "period-from")),
    to: readDate(text(formData, "period-to")),
  };
}

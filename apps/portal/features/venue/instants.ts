/**
 * A date and time field's value as an instant in Vietnam time: R1's field holds "2026-09-30T18:30" and sends
 * "2026-09-30T18:30+07:00" once both parts are whole. Null while either part is missing, so a confirmation never
 * names a time the person has not finished typing.
 */
export function instantOfField(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?:\+07:00)?$/.exec(value.trim());
  return match === null ? null : `${match[1] ?? ""}T${match[2] ?? ""}:00+07:00`;
}

/**
 * The moment an act happens, as the API would stamp it: the server's clock, in ISO 8601 with the offset.
 * The canvas's data keeps its own moments (September and October 2026); what a person does in the portal
 * happens now. The formatting layer writes either in Vietnam time.
 */
export function now(): string {
  return new Date().toISOString();
}

/** A calendar day `days` after an ISO date or timestamp, as an ISO date in Vietnam time. */
export function addDays(from: string, days: number): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Today in Vietnam time, as an ISO date. */
export function today(): string {
  return addDays(now(), 0);
}

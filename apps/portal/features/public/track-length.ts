/** A track's length as a player shows it, minutes and seconds ("3:42"): the boards' form on SCR-PUB-08 and 09. */
export function trackLength(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

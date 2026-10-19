"use client";

// Where an open list goes: fixed to the window from the trigger's box, so a scrolling table or a clipped card
// cannot cut it; below the trigger, or above when there is more room there; its start (or, with align end, its
// end) lined up with the trigger and kept inside the window; scrolling inside when neither side has room.
// Measured after the list is placed at 0,0, so a transformed ancestor does not throw it off.
export function cssPx(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return isNaN(v) ? fallback : v;
}

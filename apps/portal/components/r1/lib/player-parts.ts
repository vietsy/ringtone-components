"use client";

import { dtf, shortMonth } from "./formatting";
import { lang } from "./helpers";
import { tx } from "./strings";
import type { Family, Locale, Tone } from "./types";

export const RETIRED_TONES: Readonly<Record<"lime" | "stone" | "sky", Tone>> = { lime: "teal", stone: "blue", sky: "blue" };

export function toneOf(title: string | null | undefined): Tone {
  const x = hashOf(title || ""),
    k = x % 4;
  const was = k === 1 ? ["teal", "lime", "stone"][(x >>> 2) % 3] : ["teal", "", "lime", "stone"][k];
  // kept is always lime or stone: was when it is one of them, else one of the two.
  const kept = (was === "lime" || was === "stone" ? was : ["lime", "stone"][(x >>> 8) % 2]) as "lime" | "stone";
  return RETIRED_TONES[kept];
}

export function hashOf(s: string | null | undefined): number {
  let x = 2166136261;
  s = String(s || "");
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

export function clockOf(s: number | null | undefined): string {
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60),
    r = s % 60;
  return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
}

// The position as a person says it, for screen readers: "1 phút 24 giây trên 4 phút 36 giây".
function spokenClock(s: number | null | undefined, locale: Locale | undefined): string {
  const d = tx(locale).deck;
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60),
    r = s % 60,
    out: string[] = [];
  if (m) out.push(m + " " + (m === 1 ? d.min : d.mins));
  if (r || !m) out.push(r + " " + (r === 1 ? d.sec : d.secs));
  return out.join(" ");
}

export function positionText(
  at: number | null | undefined,
  dur: number | null | undefined,
  locale: Locale | undefined,
): string {
  return tx(locale).deck.posOf.replace("{at}", spokenClock(at, locale)).replace("{of}", spokenClock(dur, locale));
}

// The day under the clock, the way the reader's language writes it: "Thứ Hai, 28 thg 9", "Mon 28 Sep".
export function dayOf(d: Date | null | undefined, locale: Locale | undefined): string | null {
  if (!d) return null;
  return lang(locale) === "en"
    ? shortMonth(dtf("en", { weekday: "short", day: "numeric", month: "short" }).format(d))
    : dtf("vi", { weekday: "long", day: "numeric", month: "short" }).format(d);
}

export const RAIL_FAMILIES: Readonly<Record<Family, 1>> = { positive: 1, attention: 1, danger: 1, neutral: 1, info: 1 };

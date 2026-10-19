"use client";

import { formatCount } from "./lib/formatting";
import { cx, isNil, lang } from "./lib/helpers";
import { tx } from "./lib/strings";
import { missingValue, valueSizeClass } from "./lib/value-atoms";
import type { ValueSize } from "./lib/value-atoms";
import type { Locale } from "./lib/types";

// unit: the word after the number; { one, other } follows the reader's plural ("1 field", "4,120 fields").
function unitFor(
  unit: string | { one: string; other: string; [form: string]: string } | null | undefined,
  v: number,
  locale: Locale | undefined,
): string | null {
  if (isNil(unit) || unit === "") return null;
  if (typeof unit !== "object") return String(unit);
  let form: string;
  try {
    form = new Intl.PluralRules(lang(locale) === "en" ? "en-GB" : "vi-VN").select(v);
  } catch {
    form = v === 1 ? "one" : "other";
  }
  return unit[form] || unit.other || unit.one || null;
}

export type CountValueProps = {
  value: number | null;
  /** the word after the number; { one, other } follows the English plural ("1 field", "4,120 fields") */ unit?:
    string | { one: string; other: string } | undefined;
  missing?: string | undefined;
  /** Figma's Size: md is text-base, sm text-sm, each with its leading; left out, the count takes its container's type */ size?:
    ValueSize | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
};

export function CountValue(p: CountValueProps) {
  const t = tx(p.locale);
  const s = formatCount(p.value, p.locale);
  const cls = cx("r1-num", valueSizeClass(p.size), p.className);
  if (s === null) return missingValue(p.missing, t.noValue, cls);
  const u = unitFor(p.unit, p.value!, p.locale);
  return <span className={cls}>{u ? s + " " + u : s}</span>;
}

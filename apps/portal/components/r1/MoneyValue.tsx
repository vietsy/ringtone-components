"use client";

import { formatMoney } from "./lib/formatting";
import { cx } from "./lib/helpers";
import { tx } from "./lib/strings";
import { missingValue, valueSizeClass } from "./lib/value-atoms";
import type { ValueSize } from "./lib/value-atoms";
import type { Locale } from "./lib/types";

export type MoneyValueProps = {
  amountMinor: number | null;
  currency?: string | undefined;
  /** the digits alone, when a table header already names the currency */ bare?: boolean | undefined;
  /** words shown instead of the dash when there is no amount, such as "Chưa tính phí" */ missing?: string | undefined;
  /** Figma's Size: md is text-base, sm text-sm, each with its leading; left out, the amount takes its container's type */ size?:
    ValueSize | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
};

export function MoneyValue(p: MoneyValueProps) {
  const t = tx(p.locale);
  const s = formatMoney(p.amountMinor, p.currency, p.locale, p.bare);
  const cls = cx("r1-num", valueSizeClass(p.size), p.className);
  if (s === null) return missingValue(p.missing, t.notCalculated, cls);
  return <span className={cls}>{s}</span>;
}

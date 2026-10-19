"use client";

import { Icon } from "./Icon";
import { formatPeriod, formatTimestamp } from "./lib/formatting";
import { cx } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type FreshnessLineProps = {
  period?: string | { from: string; to: string } | undefined;
  asOf?: string | undefined;
  cadence?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
};

// When a figure that is not live was worked out, in one line: the period, the time it was computed, the cadence.
// A part that is missing is left out; with nothing known the line says so.
export function FreshnessLine(p: FreshnessLineProps) {
  const t = tx(p.locale);
  const period =
    p.period && typeof p.period === "object" ? formatPeriod(p.period.from, p.period.to, p.locale) : p.period;
  const at = formatTimestamp(p.asOf, p.locale);
  const head = [period ? t.figures + " " + period : null, at ? t.asOf + " " + at : null].filter(Boolean).join(", ");
  const text = head && p.cadence ? head + ". " + p.cadence : head || p.cadence || t.freshUnknown;
  return (
    <p className={cx("r1-fresh", p.className)}>
      <Icon name="clock" size={16} />
      <span>{text.charAt(0).toUpperCase() + text.slice(1)}</span>
    </p>
  );
}

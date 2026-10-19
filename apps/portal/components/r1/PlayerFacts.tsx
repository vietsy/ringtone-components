"use client";

import type * as React from "react";
import { cx } from "./lib/helpers";
import { playerLine, playerValue } from "./lib/player";
import type { Locale, PlayerLine, PlayerValue } from "./lib/types";

export type PlayerFactsProps = {
  title?: string | undefined;
  items: { label: string; value: PlayerValue; note?: PlayerLine | undefined; code?: boolean | undefined }[];
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Facts beside a Player alert: what the device still holds. A code reads in monospace; a number or a date
// is written for the locale.
export function PlayerFacts(p: PlayerFactsProps) {
  const items = p.items || [];
  return (
    <div className={cx("r1-pfacts", p.className)} style={p.style}>
      {p.title ? <p className="r1-pfacts__title">{p.title}</p> : null}
      <dl>
        {items.map(function (it, i) {
          return (
            <div key={i} className={cx("r1-pfacts__item", it.code && "r1-pfacts__item--code")}>
              <dt>{it.label}</dt>
              <dd className={cx("r1-pfacts__value", it.code ? "r1-mono" : "r1-num")}>
                {it.code ? (it.value as React.ReactNode) : playerValue(it.value, p.locale)}
              </dd>
              {it.note ? <dd className="r1-pfacts__note">{playerLine(it.note, p.locale)}</dd> : null}
            </div>
          );
        })}
      </dl>
    </div>
  );
}

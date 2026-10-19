"use client";

import type * as React from "react";
import { Button } from "./Button";
import { cx, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type FieldRowProps = {
  title: string;
  /** Figma's Columns: 1 (the base row grid, as leaving it out), 2 or 3; 4 is code's own, for a short row of short fields */ columns?:
    1 | 2 | 3 | 4 | undefined;
  density?: "console" | "portal" | "premises" | undefined;
  removable?: boolean | undefined;
  onRemove?: (() => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

// Its fields sit in 1 to 4 columns and fold to two, then one, as the row narrows (at 640 and 448 px). One column is the
// base grid itself, so columns={1} adds no class and draws exactly what leaving it out draws.
export function FieldRow(p: FieldRowProps) {
  const t = tx(p.locale);
  const id = useUid("r1-row");
  return (
    <div className={cx("r1-frow", p.className)} role="group" aria-labelledby={id} style={p.style}>
      <div className="r1-frow__head">
        <span id={id} className="r1-frow__title">
          {p.title}
        </span>
        {p.removable === false ? null : (
          <Button
            variant="quiet"
            size={p.density === "premises" || p.density === "portal" ? "md" : "sm"}
            icon="x"
            onClick={p.onRemove}
            aria-label={t.rows.remove + ": " + p.title}
            locale={p.locale}
          >
            {t.rows.removeShort}
          </Button>
        )}
      </div>
      <div className={cx("r1-frow__fields", p.columns && p.columns > 1 && "r1-frow__fields--" + p.columns)}>
        {p.children}
      </div>
    </div>
  );
}

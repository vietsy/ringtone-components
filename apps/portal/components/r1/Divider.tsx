"use client";

import type * as React from "react";
import { cx } from "./lib/helpers";

export type DividerProps = { className?: string | undefined; style?: React.CSSProperties | undefined };

// A hairline between the sections of one panel. Decorative: the section headings carry the structure.
export function Divider(p: DividerProps) {
  return <hr className={cx("r1-divider", p.className)} aria-hidden="true" style={p.style} />;
}

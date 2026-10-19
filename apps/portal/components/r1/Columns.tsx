"use client";

import type * as React from "react";
import { cx } from "./lib/helpers";

export type ColumnsProps = {
  /**
   * main-side: the content, then a side column; side-main: the side column first; halves, thirds, quarters: two, three or
   * four equal columns (quarters fold to two before one)
   */
  layout?: "main-side" | "side-main" | "halves" | "thirds" | "quarters" | undefined;
  /** The side column's width: container-2xs (288), container-sm (384, the default) or container-md (448). */
  side?: "2xs" | "sm" | "md" | undefined;
  /**
   * main-side with the side column first in the source: folded, it reads first; beside the content it still sits at the
   * end. The first child is the side column, the second the content.
   */
  sideFirst?: boolean | undefined;
  /** One column at every width: the page is laid out for a phone or a tablet, or has nothing to set beside its content. */
  single?: boolean | undefined;
  /**
   * thirds or quarters with columns of their own proportions once there is room for all of them, e.g.
   * "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)"; they fold as the layout does.
   */
  template?: string | undefined;
  /** The space between the columns and between their rows: space-4, space-6 (the default) or space-8. */
  gap?: 4 | 6 | 8 | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

// Columns that fold to one as their own box narrows, whatever the window: a console with its rail, a portal and iPad Safari
// (which names itself a Mac, so the server lays it out as a desktop) read alike. A side column stays while the content
// beside it keeps 448 px; halves keep two columns of 320 px, thirds and quarters columns of 192 px. Narrower, the children
// stack in their source order. Fields placed directly in halves start their boxes on one line, whatever their labels and
// help text.
export function Columns(p: ColumnsProps) {
  return (
    <div className={cx("r1-cols", p.className)} style={p.style}>
      <div
        className={cx(
          "r1-cols__grid",
          "r1-cols__grid--" + (p.layout || "main-side"),
          (p.layout || "main-side").includes("side") && p.side && p.side !== "sm" && "r1-cols__grid--side-" + p.side,
          p.sideFirst && "r1-cols__grid--sidefirst",
          p.single && "r1-cols__grid--single",
          p.gap === 4 && "r1-cols__grid--gap-4",
          p.gap === 8 && "r1-cols__grid--gap-8",
        )}
        style={p.template ? ({ "--r1-cols-template": p.template } as React.CSSProperties) : undefined}
      >
        {p.children}
      </div>
    </div>
  );
}

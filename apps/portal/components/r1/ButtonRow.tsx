"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { cx } from "./lib/helpers";
import { cssPx } from "./lib/menus-and-notices";

export type ButtonRowProps = {
  align?: "start" | "end" | "between" | undefined;
  label?: string | undefined;
  /** at or below bp-xs 480 px the row sticks to the bottom of the window, with a hairline above it, and stays in the page's flow so the page keeps room for it */ sticky?:
    boolean | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

// A row of two or more buttons (and links drawn as buttons), space-2 apart, wrapping onto a second line when the row
// is too narrow. A disabled button's reason leaves its slot and goes under the whole row, in button order, so the next
// button keeps its place; each reason stays linked to its own button (aria-describedby, set by Button). This is what a
// Dialog footer does; ButtonRow is the same rule anywhere else. align: start (default), end, between. label: a name
// for the group, read when focus enters it; without it the row is plain layout and has no role.
// sticky: at or below bp-xs (480 px) the row sticks to the bottom of the window with a hairline above it, so the
// decision stays in reach on a long form on a phone. It stays in the page's flow, so the page keeps its room and the
// last field is never under it; the page also scrolls a focused field clear of it. Wider, it is an ordinary row.
// While it sticks (its bottom edge held at the window's), it is marked r1-btnrow--stuck, and only then does it draw its
// band; resting at the end of its form it looks like any other row.
export function ButtonRow(p: ButtonRowProps) {
  const align = p.align === "end" || p.align === "between" ? p.align : null;
  const rowRef = useRef<HTMLDivElement>(null);
  const stuck = useState(false);
  useEffect(
    function () {
      if (!p.sticky || !rowRef.current || typeof IntersectionObserver === "undefined") return undefined;
      const io = new IntersectionObserver(
        function (es) {
          const r = es[es.length - 1]!.intersectionRatio;
          stuck[1](r > 0 && r < 1);
          // It sticks space-3 above the window's bottom edge, so the watched edge is a hairline above that.
        },
        { rootMargin: "0px 0px -" + (cssPx("--space-3", 12) + 1) + "px 0px", threshold: [0, 1] },
      );
      io.observe(rowRef.current);
      return function () {
        io.disconnect();
      };
    },
    [!!p.sticky],
  );
  return (
    <div
      ref={rowRef}
      className={cx(
        "r1-btnrow",
        align && "r1-btnrow--" + align,
        p.sticky && "r1-btnrow--sticky",
        p.sticky && stuck[0] && "r1-btnrow--stuck",
        p.className,
      )}
      role={p.label ? "group" : undefined}
      aria-label={p.label || undefined}
      style={p.style}
    >
      {p.children}
    </div>
  );
}

"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { formatCount } from "./lib/formatting";
import { cx, focusEl, focusables, isNil } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { ActionSpec, Locale } from "./lib/types";

// Focus that was in a control that has just gone moves to the next control on the page, or the last one before.
function focusAfter(anchor: Node) {
  const all = focusables(document.body);
  for (let i = 0; i < all.length; i++)
    if (anchor.compareDocumentPosition(all[i]!) & 4) {
      focusEl(all[i]);
      return;
    }
  if (all.length) focusEl(all[all.length - 1]);
}

export type BulkBarProps = {
  count: number;
  total?: number | undefined;
  actions?: ActionSpec[] | undefined;
  /** called with the click event of the clear button */ onClear?: ((e?: unknown) => void) | undefined;
  sticky?: boolean | undefined;
  density?: "console" | "portal" | undefined;
  label?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// What is selected and what can be done to all of it at once. The bar appears only while something is
// selected; its live region is there from the start, so the first count is said, and so is a cleared selection.
export function BulkBar(p: BulkBarProps) {
  const t = tx(p.locale).bulk;
  const liveRef = useRef<HTMLSpanElement>(null);
  const wasOn = useRef(false);
  const cleared = useRef(false);
  const size = p.density === "portal" ? "md" : "sm";
  const countText = p.count
    ? (isNil(p.total) ? t.count : t.countOf)
        .replace("{n}", formatCount(p.count, p.locale)!)
        .replace("{total}", String(formatCount(p.total, p.locale)))
    : "";
  const liveText = p.count ? countText : wasOn.current ? t.cleared : "";
  useEffect(function () {
    if (!p.count && cleared.current && liveRef.current) {
      const at = document.activeElement;
      if (!at || at === document.body) focusAfter(liveRef.current);
    }
    cleared.current = false;
    wasOn.current = !!p.count;
  });
  const live = (
    <span key="live" ref={liveRef} className="r1-sr" role="status">
      {liveText}
    </span>
  );
  return (
    <>
      {live}
      {p.count ? (
        <div
          key="bar"
          className={cx("r1-bulk", p.sticky && "r1-bulk--sticky", p.className)}
          role="region"
          aria-label={p.label || t.label}
          style={p.style}
        >
          <span className="r1-bulk__count" aria-hidden="true">
            {countText}
          </span>
          <span className="r1-bulk__actions">
            {(p.actions || []).map(function (a, i) {
              return (
                <Button
                  key={i}
                  variant={a.variant || "secondary"}
                  size={size}
                  icon={a.icon}
                  href={a.href}
                  disabled={a.disabled}
                  disabledReason={a.disabledReason}
                  onClick={a.onClick}
                  locale={p.locale}
                >
                  {a.label}
                </Button>
              );
            })}
          </span>
          <Button
            variant="quiet"
            size={size}
            onClick={function (e) {
              cleared.current = true;
              if (p.onClear) p.onClear(e);
            }}
            locale={p.locale}
          >
            {t.clear}
          </Button>
        </div>
      ) : null}
    </>
  );
}

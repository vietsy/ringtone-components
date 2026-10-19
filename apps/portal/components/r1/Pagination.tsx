"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { formatCount } from "./lib/formatting";
import { cx, focusEl, isNil, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type PaginationProps = {
  summary: React.ReactNode;
  hasPrev?: boolean | undefined;
  hasNext?: boolean | undefined;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  onFirst?: (() => void) | undefined;
  prevHref?: string | undefined;
  nextHref?: string | undefined;
  firstHref?: string | undefined;
  pageSizes?: number[] | undefined;
  pageSize?: number | undefined;
  /** kept for older pages: receives the change event */ onPageSize?: ((e: unknown) => void) | undefined;
  onPageSizeChange?: ((size: number, e: unknown) => void) | undefined;
  name?: string | undefined;
  /** true, or the button that spins */ loading?: boolean | "next" | "prev" | "first" | undefined;
  endNote?: string | false | undefined;
  density?: "console" | "portal" | undefined;
  label?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

type PagerButton = "next" | "prev" | "first";

// Cursor paging: what is shown, a way back to the start, previous and next. No page numbers,
// because a cursor cannot jump; a button that cannot act is left out rather than disabled, and when the
// button the reader pressed leaves (Next on the last page), focus moves to the one that stays.
// loading: the pressed button spins and the range says a page is loading; presses wait until it arrives.
export function Pagination(p: PaginationProps) {
  const t = tx(p.locale).pager;
  const size = p.density === "portal" ? "md" : "sm";
  const sizeId = useUid("r1-pgs");
  const ps = useSynced(isNil(p.pageSize) ? "" : String(p.pageSize), "");
  const rootRef = useRef<HTMLElement>(null);
  const pressed = useRef<PagerButton | null>(null);
  const loading = !!p.loading;
  const busy = typeof p.loading === "string" ? p.loading : loading ? pressed.current : null;
  useEffect(function () {
    const root = rootRef.current,
      was = pressed.current;
    if (!root || !was || loading) return;
    pressed.current = null;
    const at = document.activeElement;
    if (at && at !== document.body) return;
    const labels = { next: t.next, prev: t.prev, first: t.first };
    const pref: PagerButton[] = was === "next" ? ["prev", "first"] : ["next"];
    const btns = Array.prototype.slice.call(root.querySelectorAll(".r1-pager__actions .r1-btn")) as Element[];
    for (let i = 0; i < pref.length; i++) {
      for (let j = 0; j < btns.length; j++)
        if (btns[j]!.textContent.trim() === labels[pref[i]!]) {
          focusEl(btns[j]);
          return;
        }
    }
    focusEl(root.querySelector(".r1-pager__range"));
  });
  function go(which: PagerButton, fn: ((e: unknown) => void) | undefined) {
    return function (e: unknown) {
      if (loading) {
        if (e && (e as React.SyntheticEvent).preventDefault) (e as React.SyntheticEvent).preventDefault();
        return;
      }
      pressed.current = which;
      if (fn) fn(e);
    };
  }
  return (
    <nav
      ref={rootRef}
      className={cx("r1-pager", "r1-pager--" + (p.density || "console"), p.className)}
      aria-label={p.label || t.label}
      style={p.style}
    >
      <p className="r1-pager__range" role="status" tabIndex={-1} aria-busy={loading ? "true" : undefined}>
        <span>{p.summary}</span>
        {loading ? (
          <span className="r1-pager__loading">
            <Icon name="loader-circle" size={16} spin={true} />
            <span>{t.loading}</span>
          </span>
        ) : null}
        {!loading && !p.hasNext && p.endNote !== false ? (
          <span className="r1-pager__end-note">{p.endNote || t.end}</span>
        ) : null}
      </p>
      <div className="r1-pager__actions">
        {p.pageSizes ? (
          <span className="r1-pager__size">
            <label htmlFor={sizeId}>{t.perPage}</label>
            <span className="r1-select r1-pager__select">
              <select
                id={sizeId}
                name={p.name}
                className="r1-input r1-select__native"
                value={ps[0]}
                disabled={loading}
                onChange={function (e) {
                  ps[1](e.target.value);
                  if (p.onPageSize) p.onPageSize(e);
                  if (p.onPageSizeChange) p.onPageSizeChange(Number(e.target.value), e);
                }}
              >
                {p.pageSizes.map(function (n) {
                  return (
                    <option key={n} value={n}>
                      {formatCount(n, p.locale)}
                    </option>
                  );
                })}
              </select>
              <Icon name="chevron-down" size={16} className="r1-select__chev" />
            </span>
          </span>
        ) : null}
        {p.hasPrev ? (
          <Button
            variant="quiet"
            size={size}
            href={p.firstHref}
            loading={busy === "first"}
            onClick={go("first", p.onFirst)}
            locale={p.locale}
          >
            {t.first}
          </Button>
        ) : null}
        {p.hasPrev ? (
          <Button
            size={size}
            icon="chevron-left"
            href={p.prevHref}
            loading={busy === "prev"}
            onClick={go("prev", p.onPrev)}
            locale={p.locale}
          >
            {t.prev}
          </Button>
        ) : null}
        {p.hasNext ? (
          <Button
            size={size}
            iconRight="chevron-right"
            href={p.nextHref}
            loading={busy === "next"}
            onClick={go("next", p.onNext)}
            locale={p.locale}
          >
            {t.next}
          </Button>
        ) : null}
      </div>
    </nav>
  );
}

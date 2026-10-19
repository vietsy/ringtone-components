"use client";

import type * as React from "react";
import { useState } from "react";
import { Icon } from "./Icon";
import { formatCount } from "./lib/formatting";
import { cx, isNil, useSynced, useUid } from "./lib/helpers";
import type { Locale } from "./lib/types";

export type TabsProps = {
  tabs: {
    id: string;
    label: string;
    count?: number | undefined;
    disabled?: boolean | undefined;
    reason?: string | undefined;
    /** link tabs: each tab is a page; the list becomes a nav of links and value marks aria-current */ href?:
      string | undefined;
  }[];
  value?: string | undefined;
  onChange?: ((id: string) => void) | undefined;
  label: string;
  density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Sections of one page. Arrow keys, Home and End move between tabs; the panel is labelled by its tab.
export function Tabs(p: TabsProps) {
  const id = useUid("r1-tabs");
  const tabs = p.tabs || [];
  const firstOpen =
    tabs.filter(function (tb) {
      return !tb.disabled;
    })[0] || tabs[0];
  // The tab keeps its own choice and follows value whenever the page passes one, so onChange without value
  // still moves. A value that names no tab falls back to the first open tab, so the list always has its tab stop.
  const st = useSynced(p.value, firstOpen && firstOpen.id);
  const cur = tabs.some(function (tb) {
    return tb.id === st[0];
  })
    ? st[0]
    : firstOpen && firstOpen.id;
  function pick(v: string) {
    st[1](v);
    if (p.onChange) p.onChange(v);
  }
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(e.key) < 0) return;
    e.preventDefault();
    const list = Array.prototype.slice.call(e.currentTarget.querySelectorAll('[role="tab"]')) as HTMLElement[];
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? list[0]
        : e.key === "End"
          ? list[list.length - 1]
          : list[(at + (e.key === "ArrowLeft" ? list.length - 1 : 1)) % list.length];
    if (next) {
      next.focus();
      next.click();
    }
  }
  const hint = useState<string | null>(null);
  // Link tabs: when the tabs carry href, each is a page of its own (a queue, a register), so the list is a
  // navigation landmark of links, the current one marked aria-current, and the content below is the page.
  if (
    tabs.some(function (tb) {
      return !!tb.href;
    })
  ) {
    return (
      <div
        className={cx("r1-tabs", "r1-tabs--" + (p.density || "portal"), "r1-tabs--links", p.className)}
        style={p.style}
      >
        <nav className="r1-tabs__list" aria-label={p.label}>
          {tabs.map(function (tb) {
            const on = tb.id === cur;
            return (
              <a key={tb.id} href={tb.href} className="r1-tabs__tab" aria-current={on ? "page" : undefined}>
                <span>{tb.label}</span>
                {isNil(tb.count) ? null : (
                  <span className="r1-tabs__count r1-num">{formatCount(tb.count, p.locale)}</span>
                )}
              </a>
            );
          })}
        </nav>
        {p.children ? <div className="r1-tabs__panel">{p.children}</div> : null}
      </div>
    );
  }
  return (
    <div className={cx("r1-tabs", "r1-tabs--" + (p.density || "portal"), p.className)} style={p.style}>
      <div className="r1-tabs__list" role="tablist" aria-label={p.label} onKeyDown={onKey}>
        {tabs.map(function (tb) {
          const on = tb.id === cur;
          const why = tb.disabled && tb.reason ? id + "-why-" + tb.id : undefined;
          return (
            <button
              key={tb.id}
              id={id + "-t-" + tb.id}
              type="button"
              role="tab"
              className={cx("r1-tabs__tab", tb.disabled && "r1-tabs__tab--off")}
              aria-selected={on ? "true" : "false"}
              aria-controls={id + "-p"}
              tabIndex={on ? 0 : -1}
              aria-disabled={tb.disabled ? "true" : undefined}
              aria-describedby={why}
              onClick={function () {
                if (!tb.disabled) pick(tb.id);
              }}
              onFocus={
                why
                  ? function () {
                      hint[1](tb.id);
                    }
                  : undefined
              }
              onBlur={
                why
                  ? function () {
                      hint[1](null);
                    }
                  : undefined
              }
              onMouseEnter={
                why
                  ? function () {
                      hint[1](tb.id);
                    }
                  : undefined
              }
              onMouseLeave={
                why
                  ? function () {
                      hint[1](null);
                    }
                  : undefined
              }
            >
              <span>{tb.label}</span>
              {isNil(tb.count) ? null : (
                <span className="r1-tabs__count r1-num">{formatCount(tb.count, p.locale)}</span>
              )}
            </button>
          );
        })}
      </div>
      {tabs
        .filter(function (tb) {
          return tb.disabled && tb.reason;
        })
        .map(function (tb) {
          return (
            <p key={tb.id} id={id + "-why-" + tb.id} className="r1-tabs__why" hidden={hint[0] !== tb.id}>
              <Icon name="info" size={16} />
              <span>{tb.reason}</span>
            </p>
          );
        })}
      {p.children ? (
        <div id={id + "-p"} role="tabpanel" className="r1-tabs__panel" aria-labelledby={id + "-t-" + cur} tabIndex={0}>
          {p.children}
        </div>
      ) : null}
    </div>
  );
}

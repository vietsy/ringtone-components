"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";
import { cx, isNil, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale, StatusValue } from "./lib/types";

export type QueueListProps = {
  items: {
    title: string;
    meta?: string | undefined;
    status?: StatusValue | undefined;
    age?: string | undefined;
    checked?: boolean | undefined;
  }[];
  activeIndex?: number | undefined;
  label?: string | undefined;
  /** tick boxes and X; by default with onToggle or a ticked item */ selectable?: boolean | undefined;
  onOpen?: ((item: unknown, index: number) => void) | undefined;
  onToggle?: ((index: number, checked: boolean, item: unknown) => void) | undefined;
  onBack?: (() => void) | undefined;
  showKeys?: boolean | undefined;
  loading?: boolean | undefined;
  emptyText?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

/** A line of the key legend: the keys, then what they do. */
type KeyHint = [string[], string];

// Arrows move, Enter or a click opens (onOpen), X or a click on the box ticks for a bulk decision (onToggle),
// Escape goes back (onBack). The boxes appear only when the queue is selectable (by default: with onToggle or a
// ticked item), and the key legend lists only the keys that do something here. Empty and loading are said in words.
export function QueueList(p: QueueListProps) {
  const t = tx(p.locale);
  const uid = useUid("r1-q");
  const items = p.items || [];
  const st = useSynced(p.activeIndex, 0);
  const active = st[0],
    setActive = st[1];
  const seed = items
    .map(function (it) {
      return it.checked ? "1" : "0";
    })
    .join("");
  const ck = useSynced(seed, seed);
  const selectable = isNil(p.selectable)
    ? !!p.onToggle ||
      items.some(function (it) {
        return it.checked;
      })
    : !!p.selectable;
  const legend = (t.queue.keys as KeyHint[]).filter(function (k, i) {
    return i === 0 || (i === 1 && !!p.onOpen) || (i === 2 && !!p.onBack) || (i === 3 && selectable);
  });
  function tick(i: number) {
    const on = ck[0].charAt(i) !== "1";
    ck[1](ck[0].slice(0, i) + (on ? "1" : "0") + ck[0].slice(i + 1));
    if (p.onToggle) p.onToggle(i, on, items[i]);
  }
  function onKey(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(items.length - 1, Math.max(-1, active) + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(0, active - 1));
    } else if (e.key === "Enter" && active >= 0 && p.onOpen) {
      e.preventDefault();
      p.onOpen(items[active], active);
    } else if ((e.key === "x" || e.key === "X") && selectable && active >= 0 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      tick(active);
    } else if (e.key === "Escape" && p.onBack) {
      e.preventDefault();
      p.onBack();
    }
  }
  let body: React.ReactNode;
  if (p.loading && !items.length) {
    body = (
      <div className="r1-queue__state" aria-busy="true">
        <span className="r1-sr" role="status">
          {t.loading}
        </span>
        {[0, 1, 2].map(function (i) {
          return (
            <span key={i} className="r1-queue__skel" aria-hidden="true">
              <span className="r1-skel" style={{ width: 70 - i * 12 + "%" }} />
              <span className="r1-skel" style={{ width: 45 + i * 8 + "%" }} />
            </span>
          );
        })}
      </div>
    );
  } else if (!items.length) {
    body = (
      <p className="r1-queue__empty" role="status">
        {p.emptyText || t.queue.empty}
      </p>
    );
  } else {
    body = (
      <ul
        className={cx("r1-queue__list", !selectable && "r1-queue__list--plain")}
        role="listbox"
        aria-label={p.label}
        aria-multiselectable={selectable ? "true" : undefined}
        tabIndex={0}
        onKeyDown={onKey}
        aria-activedescendant={active >= 0 ? uid + "-" + active : undefined}
        data-r1-focus-keys={
          "arrowup arrowdown" + (p.onOpen ? " enter" : "") + (p.onBack ? " escape" : "") + (selectable ? " x" : "")
        }
      >
        {items.map(function (it, i) {
          const on = ck[0].charAt(i) === "1";
          return (
            <li
              key={i}
              id={uid + "-" + i}
              role="option"
              aria-selected={(selectable ? on : i === active) ? "true" : "false"}
              className={cx(
                "r1-queue__item",
                i === active && "r1-queue__item--active",
                on && "r1-queue__item--checked",
              )}
              onClick={function () {
                setActive(i);
                if (p.onOpen) p.onOpen(it, i);
              }}
            >
              {selectable ? (
                <span
                  className="r1-queue__check"
                  aria-hidden="true"
                  onClick={function (e) {
                    e.stopPropagation();
                    setActive(i);
                    tick(i);
                  }}
                >
                  {on ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                </span>
              ) : null}
              <span className="r1-queue__main">
                <span className="r1-queue__line">
                  <span className="r1-queue__title">{it.title}</span>
                  {it.age ? <span className="r1-queue__age r1-num">{it.age}</span> : null}
                </span>
                <span className="r1-queue__line">
                  {it.meta ? <span className="r1-queue__meta">{it.meta}</span> : <span />}
                  {it.status ? (
                    <StatusBadge family={it.status.family} label={it.status.label} icon={it.status.icon} size="sm" />
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className={cx("r1-queue", p.className)} style={p.style}>
      {body}
      {p.showKeys === false || !items.length ? null : (
        <p className="r1-queue__keys">
          {legend.map(function (k, i) {
            return (
              <span key={i} className="r1-queue__key">
                {k[0].map(function (x, j) {
                  return <kbd key={j}>{x}</kbd>;
                })}
                <span>{k[1]}</span>
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}

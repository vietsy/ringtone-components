"use client";

import type * as React from "react";
import { createElement, useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { FieldMessage } from "./FieldMessage";
import { StatusBadge } from "./StatusBadge";
import { StatusIcon } from "./StatusIcon";
import { announce, cx, focusEl, isNil, textOf } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { ActionSpec, Family, Locale, StatusValue } from "./lib/types";

export type ItemListProps = {
  items: {
    key?: string | undefined;
    title: React.ReactNode;
    href?: string | undefined;
    detail?: React.ReactNode | undefined;
    lead?: React.ReactNode | undefined;
    meta?: React.ReactNode | undefined;
    status?: StatusValue | undefined;
    family?: Family | undefined;
    actions?:
      | (ActionSpec & {
          iconOnly?: boolean | undefined;
          /** the accessible name when the label needs the item ("Gỡ Then Cửa Bakery – Hai Bà Trưng"); it starts with the label */ ariaLabel?:
            string | undefined;
          /** called with the item, its index in the order the list was given, and the click event */ onClick?:
            ((item: unknown, index: number, e: unknown) => void) | undefined;
        })[]
      | undefined;
    message?: { text: string; severity?: "error" | "warning" | "info" | undefined } | undefined;
    selected?: boolean | undefined;
  }[];
  numbered?: boolean | undefined;
  reorder?: boolean | undefined;
  onMove?: ((from: number, to: number, item: unknown) => void) | undefined;
  onRemove?: ((index: number, item: unknown) => void) | undefined;
  /** leaves out reorder and the actions that would change the list */ readOnly?: boolean | undefined;
  density?: "console" | "portal" | undefined;
  label?: string | undefined;
  emptyText?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

type ItemListItem = ItemListProps["items"][number];

// A short list of things, one per row: an optional position and lead word, a title with a detail line, a status,
// row actions and a message under the row. reorder adds move up, move down and remove, each named for its row.
// Without onMove or onRemove the list keeps its own order; either way the move is said and focus follows the
// item. readOnly leaves out the controls that would change the list.
export function ItemList(p: ItemListProps) {
  const t = tx(p.locale);
  const rootRef = useRef<HTMLElement>(null);
  const follow = useRef<{ pos: number; label: string } | null>(null);
  const base = p.items || [];
  const sig = base
    .map(function (it, i) {
      return isNil(it.key) ? textOf(it.title) + "\u0002" + i : String(it.key);
    })
    .join("\u0001");
  const own = useState<{ sig: string; order: number[] | null }>({ sig: sig, order: null });
  const order =
    own[0].sig === sig && own[0].order
      ? own[0].order
      : base.map(function (x, i) {
          return i;
        });
  const items = order.map(function (i) {
    return base[i]!;
  });
  const numbered = p.numbered || p.reorder;
  const hasLead = items.some(function (it) {
    return !!it.lead;
  });
  const checks = items.some(function (it) {
    return it.family;
  });
  const size = p.density === "console" ? "sm" : "md";
  const editable = p.reorder && !p.readOnly;
  useEffect(function () {
    const f = follow.current,
      root = rootRef.current;
    if (!f || !root) return;
    follow.current = null;
    const rows = root.children;
    const row = rows[Math.min(f.pos, rows.length - 1)];
    if (!row) {
      focusEl(root);
      return;
    }
    const btn = row.querySelector('button[aria-label^="' + f.label + '"]') || row.querySelector("button");
    focusEl(btn || root);
  });
  function titleOf(it: ItemListItem): string {
    return textOf(it.title);
  }
  function move(i: number, to: number, it: ItemListItem) {
    if (to < 0 || to >= items.length) return;
    if (p.onMove) p.onMove(order[i]!, order[to]!, it);
    else {
      const n = order.slice();
      n.splice(i, 1);
      n.splice(to, 0, order[i]!);
      own[1]({ sig: sig, order: n });
    }
    follow.current = { pos: to, label: to < i ? t.itemList.up : t.itemList.down };
    announce(t.itemList.moved.replace("{title}", titleOf(it)).replace("{n}", String(to + 1)));
  }
  function remove(i: number, it: ItemListItem) {
    if (p.onRemove) p.onRemove(order[i]!, it);
    else {
      const n = order.slice();
      n.splice(i, 1);
      own[1]({ sig: sig, order: n });
    }
    follow.current = { pos: i, label: t.itemList.remove };
    announce(t.itemList.removed.replace("{title}", titleOf(it)));
  }
  if (!items.length)
    return (
      <p className={cx("r1-items__empty", p.className)} style={p.style}>
        {p.emptyText || t.itemList.empty}
      </p>
    );
  return createElement(
    numbered ? "ol" : "ul",
    {
      ref: rootRef,
      tabIndex: -1,
      className: cx(
        "r1-items",
        "r1-items--" + (p.density || "portal"),
        numbered && "r1-items--numbered",
        hasLead && "r1-items--lead",
        checks && "r1-items--checks",
        p.className,
      ),
      role: "list",
      "aria-label": p.label,
      style: p.style,
    },
    items.map(function (it, i) {
      const name = typeof it.title === "string" ? ": " + it.title : "";
      // Read-only keeps the links and any action that states why it cannot run; the rest is left out.
      let acts = (it.actions || [])
        .filter(function (a) {
          return !p.readOnly || a.href || a.disabledReason;
        })
        .map(function (a, k) {
          // ariaLabel: the accessible name when the visible words need the item to make sense out of the row ("Gỡ" is
          // named "Gỡ Then Cửa Bakery – Hai Bà Trưng"); it starts with the visible label (WCAG 2.5.3).
          return (
            <Button
              key={"a" + k}
              variant={a.variant || "secondary"}
              size={size}
              icon={a.icon}
              iconOnly={a.iconOnly}
              aria-label={a.ariaLabel || (a.iconOnly ? a.label + name : undefined)}
              href={a.href}
              disabled={a.disabled || (p.readOnly && !a.href)}
              disabledReason={a.disabledReason}
              onClick={
                a.onClick
                  ? function (e) {
                      a.onClick!(it, order[i]!, e);
                    }
                  : undefined
              }
              locale={p.locale}
            >
              {a.label}
            </Button>
          );
        });
      if (editable) {
        acts = acts.concat([
          <Button
            key="u"
            size={size}
            iconOnly={true}
            icon="chevron-up"
            aria-label={t.itemList.up + name}
            disabled={i === 0}
            onClick={function () {
              move(i, i - 1, it);
            }}
            locale={p.locale}
          />,
          <Button
            key="d"
            size={size}
            iconOnly={true}
            icon="chevron-down"
            aria-label={t.itemList.down + name}
            disabled={i === items.length - 1}
            onClick={function () {
              move(i, i + 1, it);
            }}
            locale={p.locale}
          />,
          <Button
            key="r"
            size={size}
            iconOnly={true}
            icon="x"
            aria-label={t.itemList.remove + name}
            onClick={function () {
              remove(i, it);
            }}
            locale={p.locale}
          />,
        ]);
      }
      return (
        <li
          key={isNil(it.key) ? order[i] : it.key}
          role="listitem"
          className={cx("r1-item", it.selected && "r1-item--selected")}
          aria-current={it.selected ? "true" : undefined}
        >
          <div className="r1-item__row">
            {numbered ? (
              <span className="r1-item__pos r1-num" aria-hidden="true">
                {String(i + 1)}
              </span>
            ) : null}
            {hasLead ? <span className="r1-item__lead">{it.lead || ""}</span> : null}
            {checks ? (
              <span className={"r1-item__icon r1-item__icon--" + (it.family || "neutral")}>
                {it.family ? <StatusIcon family={it.family} size={16} cutout="surface" /> : null}
              </span>
            ) : null}
            <span className="r1-item__main">
              {it.href ? (
                <a className="r1-link r1-item__title" href={it.href}>
                  {it.title}
                </a>
              ) : (
                <span className="r1-item__title">{it.title}</span>
              )}
              {it.detail ? <span className="r1-item__detail">{it.detail}</span> : null}
            </span>
            {it.meta ? <span className="r1-item__meta r1-num">{it.meta}</span> : null}
            {it.status ? (
              <StatusBadge family={it.status.family} label={it.status.label} icon={it.status.icon} size="sm" />
            ) : null}
            {acts.length ? <span className="r1-item__actions">{acts}</span> : null}
          </div>
          {it.message ? (
            <div className="r1-item__msg">
              <FieldMessage severity={it.message.severity || "warning"} locale={p.locale}>
                {it.message.text}
              </FieldMessage>
            </div>
          ) : null}
        </li>
      );
    }),
  );
}

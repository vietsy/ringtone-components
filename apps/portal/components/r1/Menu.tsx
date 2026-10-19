"use client";

import type * as React from "react";
import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { cx, focusEl, fold, isNil, useUid } from "./lib/helpers";
import { cssPx } from "./lib/menus-and-notices";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

function placeList(list: HTMLElement | null, anchor: HTMLElement | null, alignEnd: boolean) {
  if (!list || !anchor) return;
  const gap = cssPx("--space-1", 4),
    edge = cssPx("--space-2", 8);
  list.style.top = "0px";
  list.style.left = "0px";
  list.style.maxHeight = "";
  const o = list.getBoundingClientRect(),
    b = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth || window.innerWidth,
    vh = window.innerHeight;
  const hgt = list.scrollHeight + (o.height - list.clientHeight);
  const below = vh - b.bottom - gap - edge,
    above = b.top - gap - edge;
  const up = hgt > below && above > below;
  const room = Math.max(up ? above : below, 0);
  const top = up ? b.top - gap - Math.min(hgt, room) : b.bottom + gap;
  let left = alignEnd ? b.right - o.width : b.left;
  left = Math.max(edge, Math.min(left, vw - o.width - edge));
  list.style.top = top - o.top + "px";
  list.style.left = left - o.left + "px";
  if (hgt > room) list.style.maxHeight = room + "px";
  list.setAttribute("data-side", up ? "top" : "bottom");
}

export type MenuProps = {
  label?: string | undefined;
  iconOnly?: boolean | undefined;
  icon?: string | undefined;
  variant?: "primary" | "secondary" | "quiet" | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  items: {
    label?: string | undefined;
    icon?: string | undefined;
    detail?: string | undefined;
    href?: string | undefined;
    onClick?: (() => void) | undefined;
    danger?: boolean | undefined;
    disabled?: boolean | undefined;
    reason?: string | undefined;
    separator?: boolean | undefined;
    checked?: boolean | undefined;
  }[];
  open?: boolean | undefined;
  align?: "start" | "end" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// More actions behind one button. Arrow keys move, Escape closes and returns focus to the button.
// The ARIA menu button: opening moves focus to the first item (ArrowUp: the last); arrows, Home, End and a
// first letter move; Escape closes and returns to the button; Tab or a click outside closes.
export function Menu(p: MenuProps) {
  const t = tx(p.locale).menu;
  const id = useUid("r1-menu");
  const open = useState(!!p.open);
  const goTo = useRef<"first" | "last" | null>(null);
  const byReader = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const items = p.items || [];
  function listItems() {
    return rootRef.current
      ? (Array.prototype.slice.call(rootRef.current.querySelectorAll<HTMLElement>('[role^="menuitem"]')) as HTMLElement[])
      : [];
  }
  function trigger() {
    return document.getElementById(id + "-btn");
  }
  function setOpen(v: boolean, where: "first" | "last") {
    byReader.current = true;
    goTo.current = v ? where : null;
    open[1](v);
  }
  const listRef = useRef<HTMLUListElement>(null);
  // Opened by the reader, the list escapes any clipping container and follows the trigger while the page scrolls
  // or resizes. A menu drawn open by the page (a specimen on a canvas) stays in place under its button.
  const floating = open[0] && byReader.current;
  useLayoutEffect(
    function () {
      if (!floating) return undefined;
      function place() {
        placeList(listRef.current, trigger(), p.align === "end");
      }
      place();
      window.addEventListener("resize", place);
      document.addEventListener("scroll", place, true);
      return function () {
        window.removeEventListener("resize", place);
        document.removeEventListener("scroll", place, true);
      };
    },
    [floating, p.align],
  );
  useEffect(
    function () {
      if (!open[0] || !byReader.current) return undefined;
      if (goTo.current) {
        const list = listItems();
        focusEl(goTo.current === "last" ? list[list.length - 1] : list[0]);
        goTo.current = null;
      }
      function onDown(e: MouseEvent) {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) open[1](false);
      }
      document.addEventListener("mousedown", onDown);
      return function () {
        document.removeEventListener("mousedown", onDown);
      };
    },
    [open[0]],
  );
  function onButtonKey(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true, "first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true, "last");
    }
  }
  function onKey(e: React.KeyboardEvent<HTMLUListElement>) {
    const list = listItems();
    const at = list.indexOf(document.activeElement as HTMLElement);
    let go: HTMLElement | null | undefined = null;
    if (e.key === "ArrowDown") go = list[(at + 1) % list.length];
    else if (e.key === "ArrowUp") go = list[(at - 1 + list.length) % list.length];
    else if (e.key === "Home") go = list[0];
    else if (e.key === "End") go = list[list.length - 1];
    else if (e.key === "Escape") {
      e.preventDefault();
      open[1](false);
      focusEl(trigger());
      return;
    } else if (e.key === "Tab") {
      open[1](false);
      return;
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      for (let i = 1; i <= list.length; i++) {
        const c = list[(at + i) % list.length]!;
        if (fold(c.textContent).charAt(0) === fold(e.key)) {
          go = c;
          break;
        }
      }
    }
    if (go) {
      e.preventDefault();
      focusEl(go);
    }
  }
  return (
    <div ref={rootRef} className={cx("r1-menu", p.className)} style={p.style}>
      <Button
        id={id + "-btn"}
        variant={p.variant || "secondary"}
        size={p.size || "sm"}
        icon={p.iconOnly ? "ellipsis-vertical" : p.icon}
        iconRight={p.iconOnly ? undefined : "chevron-down"}
        iconOnly={p.iconOnly}
        aria-label={p.iconOnly ? p.label || t.more : undefined}
        aria-haspopup="menu"
        aria-expanded={open[0] ? "true" : "false"}
        aria-controls={id}
        onClick={function () {
          setOpen(!open[0], "first");
        }}
        onKeyDown={onButtonKey as (e: unknown) => void}
        locale={p.locale}
      >
        {p.iconOnly ? null : p.label || t.more}
      </Button>
      {open[0] ? (
        <ul
          ref={listRef}
          id={id}
          role="menu"
          className={cx("r1-menu__list", p.align === "end" && "r1-menu__list--end", floating && "r1-menu__list--float")}
          aria-labelledby={id + "-btn"}
          onKeyDown={onKey}
        >
          {items.map(function (it, i) {
            if (it.separator) return <li key={i} role="separator" className="r1-menu__sep" />;
            const off = !!it.disabled;
            const check = !isNil(it.checked);
            return (
              <li key={i} role="none">
                {createElement(
                  it.href && !off && !check ? "a" : "button",
                  {
                    role: check ? "menuitemcheckbox" : "menuitem",
                    "aria-checked": check ? (it.checked ? "true" : "false") : undefined,
                    type: it.href && !off && !check ? undefined : "button",
                    href: it.href && !off && !check ? it.href : undefined,
                    tabIndex: -1,
                    className: cx(
                      "r1-menu__item",
                      it.danger && "r1-menu__item--danger",
                      off && "r1-menu__item--off",
                      check && "r1-menu__item--check",
                    ),
                    "aria-disabled": off ? "true" : undefined,
                    onClick: off
                      ? function (e) {
                          e.preventDefault();
                        }
                      : function () {
                          if (!check) {
                            open[1](false);
                            focusEl(trigger());
                          }
                          if (it.onClick) it.onClick();
                        },
                  },
                  check ? (
                    <span className="r1-menu__box">
                      {it.checked ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                    </span>
                  ) : it.icon ? (
                    <Icon name={it.icon} size={16} />
                  ) : (
                    <span className="r1-menu__noicon" />
                  ),
                  <span className="r1-menu__text">
                    <span>{it.label}</span>
                    {(off && it.reason) || it.detail ? (
                      <span className="r1-menu__detail">{off && it.reason ? it.reason : it.detail}</span>
                    ) : null}
                  </span>,
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

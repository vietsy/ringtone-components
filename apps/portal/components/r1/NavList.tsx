"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { cx, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type NavListProps = {
  title?: string | undefined;
  label?: string | undefined;
  items: {
    label: string;
    href?: string | undefined;
    onClick?: (() => void) | undefined;
    icon?: string | undefined;
    detail?: string | undefined;
    disabled?: boolean | undefined;
    reason?: string | undefined;
    current?: boolean | undefined;
  }[];
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Where the reader can go from here: one link per row with its icon, a chevron, and a reason when a row is closed.
// The landmark is always named: by the title, else label, else "Go to". The current place is tinted and
// carries aria-current; an entry with onClick and no href is a button that looks like the links beside it.
export function NavList(p: NavListProps) {
  const id = useUid("r1-nav");
  const t = tx(p.locale);
  const items = p.items || [];
  return (
    <nav
      className={cx("r1-navlist", p.className)}
      aria-labelledby={p.title ? id : undefined}
      aria-label={p.title ? undefined : p.label || t.navlist.label}
      style={p.style}
    >
      {p.title ? (
        <h2 id={id} className="r1-navlist__title">
          {p.title}
        </h2>
      ) : null}
      <ul className="r1-navlist__list">
        {items.map(function (it, i) {
          const inner = [
            it.icon ? <Icon key="i" name={it.icon} size={20} /> : null,
            <span key="t" className="r1-navlist__text">
              <span className="r1-navlist__label">{it.label}</span>
              {it.detail ? <span className="r1-navlist__detail">{it.detail}</span> : null}
            </span>,
            it.disabled || it.current ? null : (
              <Icon key="c" name="chevron-right" size={20} className="r1-navlist__chev" />
            ),
          ];
          const cls = cx("r1-navlist__item", it.current && "r1-navlist__item--current");
          const cur = it.current ? "page" : undefined;
          return (
            <li key={i}>
              {it.disabled ? (
                <span className="r1-navlist__item r1-navlist__item--disabled" aria-disabled="true">
                  {inner}
                  {it.reason ? <span className="r1-navlist__reason">{it.reason}</span> : null}
                </span>
              ) : it.href || !it.onClick ? (
                <a className={cls} href={it.href} aria-current={cur} onClick={it.onClick}>
                  {inner}
                </a>
              ) : (
                <button type="button" className={cls} aria-current={cur} onClick={it.onClick}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

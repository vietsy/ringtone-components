"use client";

import type * as React from "react";
import { createElement, useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { DateValue } from "./DateValue";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { StatusIcon } from "./StatusIcon";
import { formatCount } from "./lib/formatting";
import { announce, cx, focusEl, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Family, Locale } from "./lib/types";

export type NoticeListProps = {
  title?: string | undefined;
  level?: 2 | 3 | undefined;
  items: {
    id?: string | undefined;
    family?: Family | undefined;
    title: string;
    body?: string | undefined;
    at?: string | undefined;
    href?: string | undefined;
    unread?: boolean | undefined;
  }[];
  /** told when the reader marks all; the list marks them itself. false hides the button */ onMarkAll?:
    (() => void) | false | undefined;
  emptyText?: string | undefined;
  loading?: boolean | undefined;
  density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Messages for the reader: what happened, when, and where to act. Unread ones say so in words too.
// Mark all as read works on its own (onMarkAll is told), says so, and leaves focus on the list's heading.
// loading with no items yet draws placeholder lines and says so.
export function NoticeList(p: NoticeListProps) {
  const t = tx(p.locale).notices;
  const id = useUid("r1-notices");
  const read = useState(false);
  const toHead = useRef(false);
  const sig = (p.items || [])
    .map(function (it, i) {
      return (it.id || i) + (it.unread ? "1" : "0");
    })
    .join("|");
  const seen = useRef(sig);
  if (seen.current !== sig) {
    seen.current = sig;
    if (read[0]) read[1](false);
  }
  const items = (p.items || []).map(function (it) {
    return read[0] && it.unread ? Object.assign({}, it, { unread: false }) : it;
  });
  const unread = items.filter(function (it) {
    return it.unread;
  }).length;
  useEffect(function () {
    if (toHead.current) {
      toHead.current = false;
      focusEl(document.getElementById(id));
    }
  });
  function markAll() {
    if (typeof p.onMarkAll === "function") p.onMarkAll();
    read[1](true);
    toHead.current = true;
    announce(t.markedAll);
  }
  return (
    <section
      className={cx("r1-notices", "r1-notices--" + (p.density || "portal"), p.className)}
      aria-labelledby={id}
      style={p.style}
    >
      <div className="r1-notices__head">
        {createElement(
          p.level === 3 ? "h3" : "h2",
          { id: id, className: "r1-notices__title", tabIndex: -1 },
          p.title || t.title,
          unread ? (
            <span className="r1-notices__count">{t.unreadCount.replace("{n}", formatCount(unread, p.locale)!)}</span>
          ) : null,
        )}
        {unread && p.onMarkAll !== false ? (
          <Button variant="quiet" size="sm" onClick={markAll} locale={p.locale}>
            {t.markAll}
          </Button>
        ) : null}
      </div>
      {items.length ? (
        <ul className="r1-notices__list">
          {items.map(function (it, i) {
            return (
              <li
                key={it.id || i}
                className={cx("r1-notice", "r1-notice--" + (it.family || "info"), it.unread && "r1-notice--unread")}
              >
                <StatusIcon family={it.family || "info"} size={20} cutout="surface" />
                <div className="r1-notice__body">
                  <div className="r1-notice__line">
                    {it.href ? (
                      <a className="r1-link r1-notice__title" href={it.href}>
                        {it.title}
                      </a>
                    ) : (
                      <span className="r1-notice__title">{it.title}</span>
                    )}
                    {it.at ? (
                      <DateValue value={it.at} mode="timestamp" locale={p.locale} className="r1-notice__at" />
                    ) : null}
                  </div>
                  {it.body ? <p className="r1-notice__text">{it.body}</p> : null}
                  {it.unread ? <span className="r1-sr">{t.unread}</span> : null}
                </div>
                {it.unread ? <span className="r1-notice__dot" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ul>
      ) : p.loading ? (
        <Skeleton variant="text" rows={3} locale={p.locale} />
      ) : (
        <EmptyState variant="not-started" title={p.emptyText || t.empty} locale={p.locale} />
      )}
    </section>
  );
}

"use client";

import * as React from "react";
import { createElement } from "react";
import { Button } from "./Button";
import { FactList } from "./FactList";
import type { FactListProps } from "./FactList";
import { Icon } from "./Icon";
import { Identifier } from "./Identifier";
import { StatusBadge } from "./StatusBadge";
import { StatusIcon } from "./StatusIcon";
import { toDate } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { EmptyAction, Locale } from "./lib/types";

// A failed load's own recovery: without onRetry, Try again reloads the page, so it never renders dead.
function reloadPage() {
  if (typeof window !== "undefined" && window.location) window.location.reload();
}

// action is a node, false, or { label, onClick, href, icon, variant }.
function emptyAction(a: EmptyStateProps["action"], p: EmptyStateProps): React.ReactNode {
  if (!a || React.isValidElement(a) || typeof a !== "object" || Array.isArray(a)) return a || null;
  return (
    <Button
      variant={(a as EmptyAction).variant || "secondary"}
      icon={(a as EmptyAction).icon}
      href={(a as EmptyAction).href}
      onClick={(a as EmptyAction).onClick}
      size={p.density === "console" ? "sm" : undefined}
      locale={p.locale}
    >
      {(a as EmptyAction).label}
    </Button>
  );
}

export type EmptyStateProps = {
  variant?: "not-started" | "governed" | "filtered" | "no-obligation" | "error" | undefined;
  title?: React.ReactNode | undefined;
  icon?: string | undefined;
  level?: 2 | 3 | 4 | 5 | 6 | undefined;
  action?: React.ReactNode | EmptyAction | false | undefined;
  onClearFilters?: (() => void) | undefined;
  traceId?: string | undefined;
  retryable?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  density?: "console" | "org" | "portal" | undefined;
  /** governed: what is waiting for a decision, shown as a fact ("Đang chờ" / "Waiting for") */ decision?:
    React.ReactNode | undefined;
  /** governed: who decides ("Người quyết định" / "Decided by") */ decider?: React.ReactNode | undefined;
  /** governed: by when, an ISO date or timestamp written in the shared format, or the page's words ("Hạn quyết định" / "Decision due") */ due?:
    string | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The title is a heading (level, default 3). Clear filters shows only with onClearFilters: without it, it did nothing.
export function EmptyState(p: EmptyStateProps) {
  const t = tx(p.locale);
  const variant = p.variant || "not-started";
  const heading = "h" + Math.min(6, Math.max(2, p.level || 3));
  const size = p.density === "console" ? "sm" : undefined;
  const own = p.action === false ? null : emptyAction(p.action, p);
  if (variant === "error") {
    return (
      <section className={cx("r1-empty r1-empty--error", p.className)} role="alert" style={p.style}>
        <StatusIcon family="danger" size={32} cutout="surface" />
        {createElement(heading, { className: "r1-empty__title" }, p.title || t.couldNotLoad)}
        {p.children ? <div className="r1-empty__text">{p.children}</div> : null}
        {p.traceId ? (
          <p className="r1-empty__text">
            {t.traceRef + " "}
            <Identifier value={p.traceId} size="sm" locale={p.locale} />
            {", " + t.quoteSupport}
          </p>
        ) : null}
        {p.retryable === false ? <p className="r1-empty__text r1-muted">{t.retryNoHelp}</p> : null}
        {p.retryable === false && !own ? null : (
          <div className="r1-empty__actions">
            {p.retryable === false ? null : (
              <Button icon="refresh-cw" size={size} onClick={p.onRetry || reloadPage} locale={p.locale}>
                {t.retry}
              </Button>
            )}
            {own}
          </div>
        )}
      </section>
    );
  }
  if (variant === "no-obligation") {
    return (
      <section className={cx("r1-empty r1-empty--positive", p.className)} role="status" style={p.style}>
        {createElement(
          heading,
          { className: "r1-empty__head" },
          <StatusBadge family="positive" label={p.title || t.empty.noObligation} size="lg" />,
        )}
        {p.children ? <div className="r1-empty__text">{p.children}</div> : null}
        {own ? <div className="r1-empty__actions">{own}</div> : null}
      </section>
    );
  }
  // governed: nothing qualified is not a success, so its icon is the neutral inbox, not a check mark.
  const icon = p.icon || (variant === "governed" ? "inbox" : variant === "filtered" ? "filter" : "clock");
  const title =
    p.title ||
    (variant === "governed" ? t.empty.governed : variant === "filtered" ? t.empty.filtered : t.empty.notStarted);
  const clear =
    !own && p.action !== false && variant === "filtered" && p.onClearFilters ? (
      <Button variant="quiet" icon="x" size={size} onClick={p.onClearFilters} locale={p.locale}>
        {t.empty.clearFilters}
      </Button>
    ) : null;
  // governed with decision, decider or due: what is waiting, who decides and by when, as three short facts under the
  // explanation. due is a date or a timestamp (written in the shared format) or the page's own words.
  const gov =
    variant === "governed"
      ? [
          isNil(p.decision) || p.decision === "" ? null : { label: t.empty.waiting, value: p.decision },
          isNil(p.decider) || p.decider === "" ? null : { label: t.empty.decider, value: p.decider },
          isNil(p.due) || p.due === ""
            ? null
            : toDate(p.due) && !/^\d{4}-\d{2}-\d{2}$/.test(String(p.due))
              ? { label: t.empty.due, value: p.due, kind: "datetime" }
              : toDate(p.due)
                ? { label: t.empty.due, value: p.due, kind: "date" }
                : { label: t.empty.due, value: p.due },
        ].filter(Boolean) as FactListProps["items"]
      : [];
  return (
    <section className={cx("r1-empty", "r1-empty--" + variant, p.className)} role="status" style={p.style}>
      <Icon name={icon} size={32} className="r1-empty__icon" />
      {createElement(heading, { className: "r1-empty__title" }, title)}
      {p.children ? <div className="r1-empty__text">{p.children}</div> : null}
      {gov.length ? <FactList className="r1-empty__facts" items={gov} locale={p.locale} /> : null}
      {own || clear ? <div className="r1-empty__actions">{own || clear}</div> : null}
    </section>
  );
}

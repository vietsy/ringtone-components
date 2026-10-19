"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import type { EmptyStateProps } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { announce, readerActed } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { EmptyAction, Family, Locale } from "./lib/types";

/** refusal.action given as data: drawn as a secondary button */
type RefusalAction = {
  label: string;
  onClick?: (() => void) | undefined;
  href?: string | undefined;
  icon?: string | undefined;
};

export type ViewStateProps = {
  view?: "populated" | "loading" | "empty" | "error" | "refused" | undefined;
  empty?:
    | {
        variant?: string | undefined;
        title?: string | undefined;
        text?: string | undefined;
        icon?: string | undefined;
        action?: React.ReactNode | EmptyAction | false | undefined;
        onClearFilters?: (() => void) | undefined;
      }
    | undefined;
  /** action: the way on when the refusal replaces the page (a 503 read: "Try again"), a secondary button under the sentence at the density's size */ refusal?:
    | {
        code?: string | undefined;
        title?: string | undefined;
        text?: string | undefined;
        family?: Family | undefined;
        action?: React.ReactNode | RefusalAction | undefined;
      }
    | undefined;
  traceId?: string | undefined;
  retryable?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  errorTitle?: string | undefined;
  errorText?: string | undefined;
  errorAction?: React.ReactNode | EmptyAction | undefined;
  skeleton?: "table" | "text" | "facts" | "card" | "chart" | undefined;
  columns?: number | undefined;
  rows?: number | undefined;
  density?: "console" | "org" | "portal" | undefined;
  level?: 2 | 3 | 4 | 5 | 6 | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
};

// One switch for a data region's state. The error view says what happened (errorTitle), what the reader can do
// (Try again, and errorAction when there is another way), and its reference. The loading view takes the shape
// of the result (skeleton, columns). When a load the reader started finishes, that is said once.
export function ViewState(p: ViewStateProps) {
  const t = tx(p.locale);
  const view = p.view || "populated";
  const prev = useRef(view);
  useEffect(
    function () {
      const was = prev.current;
      prev.current = view;
      if (was === "loading" && view !== "loading" && view !== "error" && readerActed())
        announce(t.view.loaded, "polite");
    },
    [view],
  );
  if (view === "loading")
    return (
      <Skeleton rows={p.rows || 5} variant={p.skeleton} columns={p.columns} density={p.density} locale={p.locale} />
    );
  if (view === "error")
    return (
      <EmptyState
        variant="error"
        title={p.errorTitle}
        action={p.errorAction}
        level={p.level}
        traceId={p.traceId}
        retryable={p.retryable !== false}
        onRetry={p.onRetry}
        density={p.density}
        locale={p.locale}
      >
        {p.errorText}
      </EmptyState>
    );
  if (view === "empty") {
    const e = p.empty || {};
    return (
      <EmptyState
        variant={(e.variant || "not-started") as EmptyStateProps["variant"]}
        title={e.title}
        icon={e.icon}
        action={e.action}
        onClearFilters={e.onClearFilters}
        level={p.level}
        density={p.density}
        locale={p.locale}
      >
        {e.text}
      </EmptyState>
    );
  }
  if (view === "refused") {
    const r = p.refusal || {};
    // With nothing passed, the refusal is the catalogue's NOT_AUTHORISED entry, its sentence and its code together.
    // A screen that writes its own sentence passes its own code; none is added for it.
    const own = r.title || r.text;
    // action ({label, onClick, href, icon}): the way on when the refusal replaces the page (a 503 read: "Try again"),
    // a secondary button under the sentence, at the size of the page's density.
    const a = r.action;
    const go =
      a && typeof a === "object" && !React.isValidElement(a)
        ? {
            label: (a as RefusalAction).label,
            href: (a as RefusalAction).href,
            onClick: (a as RefusalAction).onClick,
            icon: (a as RefusalAction).icon,
            variant: "secondary" as const,
          }
        : a;
    return (
      <Banner
        family={r.family || "neutral"}
        title={r.title || t.refusedTitle}
        code={r.code || (own ? undefined : "NOT_AUTHORISED")}
        level={p.level}
        action={go || undefined}
        density={go ? (p.density === "console" ? "console" : p.density ? "portal" : undefined) : undefined}
        locale={p.locale}
      >
        {r.text || t.refusedText}
      </Banner>
    );
  }
  return <>{p.children}</>;
}

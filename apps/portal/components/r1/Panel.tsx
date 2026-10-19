"use client";

import type * as React from "react";
import { createElement } from "react";
import { Button } from "./Button";
import { Link } from "./Link";
import { StatusBadge } from "./StatusBadge";
import { StatusIcon } from "./StatusIcon";
import { cx, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { ActionSpec, Family, Locale, StatusValue } from "./lib/types";

export type PanelProps = {
  title?: React.ReactNode | undefined;
  description?: React.ReactNode | undefined;
  level?: 2 | 3 | undefined;
  family?: Family | undefined;
  /** the words a screen reader hears for the family's shape */ familyLabel?: string | undefined;
  /** the badge beside the title; variant 'seal' and working pass through to StatusBadge */ status?:
    StatusValue | undefined;
  meta?: React.ReactNode | undefined;
  action?: (ActionSpec & { kind?: "button" | "link" | undefined }) | undefined;
  actions?: (ActionSpec & { kind?: "button" | "link" | undefined })[] | undefined;
  variant?: "default" | "sunken" | "plain" | undefined;
  compact?: boolean | undefined;
  layout?: "stack" | "strip" | undefined;
  gap?: "sm" | "md" | "lg" | "xl" | undefined;
  align?: "start" | "center" | undefined;
  inset?: "md" | "sm" | undefined;
  as?: "section" | "aside" | "nav" | "div" | "fieldset" | undefined;
  density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A titled region of a console or portal page. A Table inside it runs to its edges.
// The head carries what belongs to the whole region: a status shape, a badge, a short note on the right, actions.
// The status shape is said in words inside the heading (familyLabel, or the family's word); the head wraps
// when the title and the actions do not fit on one line.
export function Panel(p: PanelProps) {
  const id = useUid("r1-pnl");
  const actions = p.actions || (p.action ? [p.action] : []);
  const Heading = p.level === 3 ? "h3" : "h2";
  const small = p.density !== "portal";
  const hasHead = p.title || p.description || p.meta || p.status || actions.length;
  const familyWord = p.family ? p.familyLabel || tx(p.locale).panel[p.family] || "" : "";
  const head = hasHead ? (
    <div className="r1-panel__head">
      <div className="r1-panel__titles">
        {p.title ? (
          <div className="r1-panel__titleline">
            {p.family ? (
              <span className={"r1-panel__icon r1-panel__icon--" + p.family} aria-hidden="true">
                <StatusIcon
                  family={p.family}
                  size={20}
                  cutout={p.variant === "sunken" ? "surface-sunken" : "surface"}
                />
              </span>
            ) : null}
            <Heading id={id} className="r1-panel__title">
              {familyWord ? <span className="r1-sr">{familyWord + ": "}</span> : null}
              {p.title}
            </Heading>
            {p.status ? (
              <StatusBadge
                family={p.status.family}
                label={p.status.label}
                icon={p.status.icon}
                size="sm"
                variant={p.status.variant}
                working={p.status.working}
                locale={p.locale}
              />
            ) : null}
          </div>
        ) : null}
        {p.description ? <p className="r1-panel__desc">{p.description}</p> : null}
      </div>
      {p.meta || actions.length ? (
        <div className="r1-panel__end">
          {p.meta ? <span className="r1-panel__meta">{p.meta}</span> : null}
          {actions.map(function (a, i) {
            if (a.kind === "link")
              return (
                <Link
                  key={i}
                  href={a.href}
                  variant="standalone"
                  size={small ? "sm" : undefined}
                  icon={a.icon}
                  locale={p.locale}
                >
                  {a.label}
                </Link>
              );
            return (
              <Button
                key={i}
                variant={a.variant || "quiet"}
                size={small ? "sm" : "md"}
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
        </div>
      ) : null}
    </div>
  ) : null;
  return createElement(
    p.as === "aside" || p.as === "nav" || p.as === "div" || p.as === "fieldset" ? p.as : "section",
    {
      className: cx(
        "r1-panel",
        p.variant && p.variant !== "default" && "r1-panel--" + p.variant,
        p.compact && "r1-panel--compact",
        p.layout === "strip" && "r1-panel--strip",
        p.gap && p.gap !== "md" && "r1-panel--gap-" + p.gap,
        p.align === "center" && "r1-panel--center",
        p.inset === "sm" && "r1-panel--inset-sm",
        p.className,
      ),
      "aria-labelledby": p.title ? id : undefined,
      style: p.style,
    },
    head,
    p.children,
  );
}

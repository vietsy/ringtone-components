"use client";

import * as React from "react";
import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { StatusIcon } from "./StatusIcon";
import { announce, cx, joinSentences, readerActed, textOf } from "./lib/helpers";
import { STATUS_FAMILIES } from "./lib/icons";
import { tx } from "./lib/strings";
import type { BannerAction, Family, Locale } from "./lib/types";

// An entry of actions: a node drawn as given, or an action as data (any object that is not an element).
type BannerItem = React.ReactElement | string | number | bigint | boolean | null | undefined | BannerAction;

// Every family is tinted: shape, word and tint. A banner drawn with the page is read in order, not announced;
// one that appears after the reader acted is said once through the page's live regions (assertively for
// danger). live forces it on or off; an explicit role makes the banner its own live region instead.
// The title is a heading (level, default 2). onDismiss adds a close button; the banner then hides itself.
// actions: a node, or data a canvas can pass, { label, href, onClick, variant, icon, disabled, disabledReason }
// (one, or a list; action is the one-item form), drawn as R1 Buttons: sm (32 px) in the console, md (48 px) with
// density portal or premises, so they meet the 44 px target there. Without density the banner takes it from the
// shell around it: md inside PortalShell or PublicShell, sm elsewhere.
function bannerActions(
  a: React.ReactNode | BannerAction | BannerAction[],
  p: BannerProps,
  size: "sm" | "md",
): React.ReactNode {
  if (!a) return null;
  if (React.isValidElement(a) || typeof a !== "object") return a;
  const list = (Array.isArray(a) ? a : [a]) as BannerItem[];
  return list.map(function (x, i) {
    if (!x || React.isValidElement(x) || typeof x !== "object") return x;
    return (
      <Button
        key={i}
        size={size || "sm"}
        variant={x.variant}
        icon={x.icon}
        href={x.href}
        onClick={x.onClick}
        disabled={x.disabled}
        disabledReason={x.disabledReason}
        locale={p.locale}
      >
        {x.label}
      </Button>
    );
  });
}

export type BannerProps = {
  family?: Family | undefined;
  title?: React.ReactNode | undefined;
  level?: 2 | 3 | 4 | 5 | 6 | undefined;
  code?: string | undefined;
  actions?: React.ReactNode | BannerAction | BannerAction[] | undefined;
  action?: React.ReactNode | BannerAction | undefined;
  compact?: boolean | undefined;
  /** action and close size: console sm 32 px; portal or premises md 48 px. Without it, taken from the shell around the banner */ density?:
    "console" | "portal" | "premises" | undefined;
  live?: boolean | undefined;
  role?: string | undefined;
  onDismiss?: ((e?: unknown) => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

export function Banner(p: BannerProps) {
  const t = tx(p.locale);
  const family: Family =
    (STATUS_FAMILIES as readonly (string | undefined)[]).indexOf(p.family) >= 0 ? p.family! : "info";
  const shown = useState(true);
  const boxRef = useRef<HTMLElement>(null);
  const shellDensity = useState<"portal" | "console" | null>(null);
  useLayoutEffect(function () {
    if (p.density) return;
    const shell = boxRef.current && boxRef.current.closest(".r1-shell");
    const d =
      shell && (shell.classList.contains("r1-shell--portal") || shell.classList.contains("r1-shell--public"))
        ? "portal"
        : "console";
    if (d !== shellDensity[0]) shellDensity[1](d);
  });
  const density = p.density || shellDensity[0] || "console";
  const btnSize = density === "portal" || density === "premises" ? "md" : "sm";
  const said = joinSentences([textOf(p.title), textOf(p.children)]);
  useEffect(
    function () {
      if (p.role || p.live === false || !said) return;
      if (p.live === true || readerActed()) announce(said, family === "danger" ? "assertive" : "polite");
    },
    [said],
  );
  if (!shown[0]) return null;
  const heading = "h" + Math.min(6, Math.max(2, p.level || 2));
  // The code sits on the title line; a banner without a title gives it the line after its text, so no line
  // carries the code alone beside the status shape.
  const code = p.code
    ? createElement(
        p.title ? "span" : "p",
        { className: "r1-banner__code" },
        <span className="r1-banner__code-label">{t.code}</span>,
        " ",
        <span className="r1-banner__code-value">{p.code}</span>,
      )
    : null;
  return (
    <section
      ref={boxRef}
      className={cx(
        "r1-banner",
        "r1-banner--" + family,
        !!p.title && "r1-banner--titled",
        p.compact && "r1-banner--compact",
        p.onDismiss && "r1-banner--dismissible",
        btnSize === "md" && "r1-banner--touch",
        p.className,
      )}
      role={p.role}
      style={p.style}
    >
      <StatusIcon family={family} size={p.compact ? 16 : 20} cutout={family + "-tint"} />
      <div className="r1-banner__body">
        {p.title ? (
          <div className="r1-banner__head">
            {createElement(heading, { className: "r1-banner__title" }, p.title)}
            {code}
          </div>
        ) : null}
        {p.children ? <div className="r1-banner__text">{p.children}</div> : null}
        {p.title ? null : code}
        {p.actions || p.action ? (
          <div className="r1-banner__actions">{bannerActions(p.actions || p.action, p, btnSize)}</div>
        ) : null}
      </div>
      {p.onDismiss ? (
        <Button
          className="r1-banner__dismiss r1-btn--close"
          variant="quiet"
          size={btnSize}
          iconOnly={true}
          icon="x"
          aria-label={t.toast.close}
          locale={p.locale}
          onClick={function (e) {
            shown[1](false);
            p.onDismiss!(e);
          }}
        />
      ) : null}
    </section>
  );
}

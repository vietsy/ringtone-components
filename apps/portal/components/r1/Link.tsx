"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { keepRefs } from "./lib/button";
import { cx } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

// A text link. back puts the arrow first; external opens a new tab and says so.
// onClick, target, rel, id and every aria-* and data-* prop reach the anchor, so a router can drive it.
function linkPass(p: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.keys(p).forEach(function (k) {
    if (/^(aria|data)-/.test(k)) out[k] = p[k];
  });
  return out;
}

export type LinkProps = {
  href?: string | undefined;
  label?: React.ReactNode | undefined;
  back?: boolean | undefined;
  icon?: string | undefined;
  external?: boolean | undefined;
  variant?: "default" | "standalone" | "quiet" | undefined;
  size?: "default" | "sm" | "touch" | undefined;
  current?: boolean | "page" | "step" | "location" | undefined;
  onClick?: ((e: unknown) => void) | undefined;
  onKeyDown?: ((e: unknown) => void) | undefined;
  target?: string | undefined;
  rel?: string | undefined;
  id?: string | undefined;
  download?: string | boolean | undefined;
  hrefLang?: string | undefined;
  lang?: string | undefined;
  [aria: `aria-${string}`]: unknown;
  [data: `data-${string}`]: unknown;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function Link(p: LinkProps) {
  const t = tx(p.locale);
  const ext = !!p.external || p.target === "_blank";
  const lead = p.back ? "arrow-left" : p.icon;
  const current = p.current === true ? "page" : p.current || undefined;
  return (
    <a
      {...Object.assign(linkPass(p), {
        className: cx(
          "r1-link",
          (lead || ext) && "r1-link--icon",
          p.variant && "r1-link--" + p.variant,
          p.size && "r1-link--" + p.size,
          p.className,
        ),
        href: p.href,
        target: ext ? "_blank" : p.target,
        rel: p.rel || (ext ? "noopener noreferrer" : undefined),
        id: p.id,
        onClick: p.onClick,
        onKeyDown: p.onKeyDown,
        download: p.download,
        hrefLang: p.hrefLang,
        lang: p.lang,
        "aria-current": (p["aria-current"] as React.AriaAttributes["aria-current"]) || current,
        style: p.style,
      })}
    >
      {lead ? <Icon name={lead} size={16} /> : null}
      <span>{keepRefs(p.children || p.label)}</span>
      {ext ? <Icon name="external-link" size={16} label={t.newTab} /> : null}
    </a>
  );
}

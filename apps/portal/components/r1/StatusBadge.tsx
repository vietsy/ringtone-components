"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { StatusIcon } from "./StatusIcon";
import { cx } from "./lib/helpers";
import { ICONS, STATUS_FAMILIES } from "./lib/icons";
import { workingWords } from "./lib/status-badge";
import type { Family, Locale } from "./lib/types";

export type StatusBadgeProps = {
  family?: Family | undefined;
  label: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | undefined;
  variant?: "rect" | "seal" | undefined;
  /** a state running now: the spinning loader-circle in place of the family's shape (still under reduced motion); a screen reader hears "in progress" unless the label says so */ working?:
    boolean | undefined;
  /** the language of the words working adds */ locale?: Locale | undefined;
  /** an Icon name drawn in place of the family's shape, so two states of one family differ in shape; the tint and the word stay. Ignored with the seal and with working; an unknown name keeps the family's shape */ icon?:
    string | undefined;
  /** Figma's Show shape: false leaves the family's shape out, where a mark beside the badge already shapes the state; the word and the tint stay, and so do the paddings. The seal keeps its mark, and icon and working still draw theirs. Default true */ showShape?:
    boolean | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

// A family the badge does not know falls back to neutral, with the neutral shape and tint.
// icon: an Icon name drawn in place of the family's shape, so two states of one family differ in shape as well as in
// words ("Tạm đình chỉ" and "Đã thu hồi" are both danger). The badge keeps its three channels: the shape, the word and the
// tint. A name the icon set does not hold keeps the family's shape. The seal and working keep their own marks.
// showShape={false} (Figma's Show shape off) drops only the family's shape: the badge is then word and tint, for a place
// where the state's shape already stands beside it. Figma ties it to the StatusIcon layer alone, so the seal's mark, an
// icon and the spinner are unaffected.
export function StatusBadge(p: StatusBadgeProps) {
  const family: Family =
    (STATUS_FAMILIES as readonly (string | undefined)[]).indexOf(p.family) >= 0 ? p.family! : "neutral";
  const seal = p.variant === "seal";
  const size = p.size || "md";
  const iconSize = size === "xl" ? 32 : size === "lg" ? 20 : 16;
  const label = p.label || p.children;
  const more = p.working ? workingWords(label, p.locale) : null;
  const own = !seal && p.icon && (ICONS as Record<string, unknown>)[p.icon] ? p.icon : null;
  return (
    <span
      className={cx(
        "r1-badge",
        "r1-badge--" + (seal ? "seal" : family),
        "r1-badge--" + size,
        p.working && "r1-badge--working",
        own && "r1-badge--icon",
        p.className,
      )}
      data-family={seal ? "authority" : family}
      style={p.style}
    >
      {p.working ? (
        <Icon name="loader-circle" size={iconSize} spin={true} className="r1-badge__spin" />
      ) : own ? (
        <Icon name={own} size={iconSize} strokeWidth={2.5} className="r1-status-icon r1-badge__icon" />
      ) : seal || p.showShape !== false ? (
        <StatusIcon
          family={seal ? "seal" : family}
          size={iconSize}
          cutout={seal ? "accent-surface" : family + "-tint"}
        />
      ) : null}
      <span className="r1-badge__label">{label}</span>
      {more ? <span className="r1-sr">{more}</span> : null}
    </span>
  );
}

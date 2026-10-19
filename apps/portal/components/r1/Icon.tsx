"use client";

import { createElement } from "react";
import { cx } from "./lib/helpers";
import { ICONS } from "./lib/icons";
import type { IconProps } from "./lib/types";

export function Icon(p: IconProps) {
  const nodes = ICONS[p.name];
  if (!nodes) return null;
  const size = p.size || 20;
  return (
    <svg
      className={cx("r1-icon", p.spin && "r1-spin", p.className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={p.strokeWidth || 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={p.label ? "img" : undefined}
      aria-label={p.label || undefined}
      aria-hidden={p.label ? undefined : "true"}
      style={p.style}
    >
      {nodes.map(function (n, i) {
        return createElement(n[0], Object.assign({ key: i }, n[1]));
      })}
    </svg>
  );
}

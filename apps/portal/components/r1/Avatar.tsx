"use client";

import type * as React from "react";
import { useState } from "react";
import { cx } from "./lib/helpers";

function initialsOf(name: string): string {
  const w = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!w.length) return "?";
  const a = w[0]!.charAt(0),
    b = w.length > 1 ? w[w.length - 1]!.charAt(0) : "";
  return (a + b).toUpperCase();
}

export type AvatarProps = {
  name: string;
  src?: string | undefined;
  alt?: string | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  shape?: "circle" | "square" | undefined;
  kind?: "person" | "org" | undefined;
  decorative?: boolean | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A person or an organisation, by photo when one is on record, otherwise by initials (one at sm, 24 px). Never a stock face.
export function Avatar(p: AvatarProps) {
  const shape = p.shape || (p.kind === "org" ? "square" : "circle");
  // A photo that does not load falls back to the initials, and tries again when the page passes another photo.
  const broken = useState<string | null | undefined>(null);
  const showImg = p.src && broken[0] !== p.src;
  return (
    <span
      className={cx("r1-avatar", "r1-avatar--" + (p.size || "md"), "r1-avatar--" + shape, p.className)}
      style={p.style}
      role={p.decorative ? undefined : "img"}
      aria-label={p.decorative ? undefined : p.alt || p.name}
      aria-hidden={p.decorative ? "true" : undefined}
    >
      {showImg ? (
        <img
          src={p.src}
          alt=""
          className="r1-avatar__img"
          onError={function () {
            broken[1](p.src);
          }}
        />
      ) : (
        <span className="r1-avatar__initials" aria-hidden="true">
          {p.size === "sm" ? initialsOf(p.name).charAt(0) : initialsOf(p.name)}
        </span>
      )}
    </span>
  );
}

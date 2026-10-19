"use client";

import type * as React from "react";
import { createElement } from "react";
import { Icon } from "./Icon";
import { cx, isNil, useSynced, useUid } from "./lib/helpers";
import type { Locale } from "./lib/types";

export type DisclosureProps = {
  title: React.ReactNode;
  meta?: React.ReactNode | undefined;
  open?: boolean | undefined;
  onToggle?: ((open: boolean) => void) | undefined;
  level?: 2 | 3 | 4 | undefined;
  density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A section the reader opens when they need it: a help answer, the working behind a figure.
// It keeps its own open state and follows open whenever the page passes a new value. With onToggle and open
// both given, the page decides: a press only reports the wish.
export function Disclosure(p: DisclosureProps) {
  const st = useSynced(isNil(p.open) ? undefined : !!p.open, false);
  const held = !!p.onToggle && !isNil(p.open);
  const open = held ? !!p.open : st[0];
  const id = useUid("r1-disc");
  return (
    <div
      className={cx("r1-disc", "r1-disc--" + (p.density || "portal"), open && "r1-disc--open", p.className)}
      style={p.style}
    >
      {createElement(
        p.level === 2 ? "h2" : p.level === 4 ? "h4" : "h3",
        { className: "r1-disc__heading" },
        <button
          type="button"
          className="r1-disc__button"
          aria-expanded={open ? "true" : "false"}
          aria-controls={id}
          onClick={function () {
            if (!held) st[1](!open);
            if (p.onToggle) p.onToggle(!open);
          }}
        >
          <Icon name="chevron-right" size={p.density === "console" ? 16 : 20} className="r1-disc__chev" />
          <span className="r1-disc__title">{p.title}</span>
          {p.meta ? <span className="r1-disc__meta">{p.meta}</span> : null}
        </button>,
      )}
      <div id={id} className="r1-disc__body" hidden={!open}>
        {p.children}
      </div>
    </div>
  );
}

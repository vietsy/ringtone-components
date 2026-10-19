"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { cx, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type ToggletipProps = {
  label?: string | undefined;
  title?: string | undefined;
  text?: React.ReactNode | undefined;
  open?: boolean | undefined;
  align?: "start" | "end" | undefined;
  /** portal: a 44 px target around the 24 px button; console: 24 */ density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

// A small button that shows a definition in place. Opens on click or Enter, closes on Escape, a second press
// or a click outside; never on hover alone. The button draws at 24 px (20 in a table header) and takes the
// target size of its density: 44 px on portal pages, 24 in the console.
export function Toggletip(p: ToggletipProps) {
  const t = tx(p.locale);
  const id = useUid("r1-tt");
  const st = useState(!!p.open);
  const open = st[0];
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(
    function () {
      if (!open) return undefined;
      function onDown(e: MouseEvent | TouchEvent) {
        if (rootRef.current && !rootRef.current.contains(e.target as Node | null)) st[1](false);
      }
      document.addEventListener("mousedown", onDown);
      document.addEventListener("touchstart", onDown);
      return function () {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("touchstart", onDown);
      };
    },
    [open],
  );
  return (
    <span
      ref={rootRef}
      className={cx(
        "r1-toggletip",
        "r1-toggletip--" + (p.density === "console" ? "console" : "portal"),
        p.align === "end" && "r1-toggletip--end",
        p.className,
      )}
      style={p.style}
      onKeyDown={function (e) {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          st[1](false);
        }
      }}
    >
      <button
        type="button"
        className="r1-toggletip__button"
        aria-label={p.label || t.tip.explain}
        aria-expanded={open ? "true" : "false"}
        aria-controls={id}
        onClick={function () {
          st[1](!open);
        }}
      >
        <Icon name="circle-help" size={16} />
      </button>
      <span id={id} role="status" className="r1-toggletip__live">
        {open ? (
          <span className="r1-toggletip__bubble">
            {p.title ? <span className="r1-toggletip__title">{p.title}</span> : null}
            <span className="r1-toggletip__text">{p.children || p.text}</span>
          </span>
        ) : null}
      </span>
    </span>
  );
}

"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { cx, useUid } from "./lib/helpers";

export type TooltipProps = {
  label: string;
  placement?: "top" | "bottom" | undefined;
  open?: boolean | undefined;
  children: React.ReactElement;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The name of an icon-only control, shown on pointer over and on keyboard focus. Never holds anything else.
export function Tooltip(p: TooltipProps) {
  const id = useUid("r1-tip");
  const engaged = useState(0);
  const gone = useState(false);
  const child = p.children;
  const trigger = React.isValidElement<{ "aria-describedby"?: string | undefined }>(child)
    ? React.cloneElement(child, { "aria-describedby": [child.props["aria-describedby"], id].filter(Boolean).join(" ") })
    : child;
  useEffect(
    function () {
      if (!engaged[0]) {
        gone[1](false);
        return undefined;
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") gone[1](true);
      }
      document.addEventListener("keydown", onKey);
      return function () {
        document.removeEventListener("keydown", onKey);
      };
    },
    [engaged[0] > 0],
  );
  function bump(n: number) {
    return function () {
      engaged[1](function (v) {
        return Math.max(0, v + n);
      });
    };
  }
  return (
    <span
      className={cx(
        "r1-tip",
        "r1-tip--" + (p.placement || "top"),
        p.open && "r1-tip--open",
        gone[0] && "r1-tip--dismissed",
        p.className,
      )}
      style={p.style}
      onMouseEnter={bump(1)}
      onMouseLeave={bump(-1)}
      onFocus={bump(1)}
      onBlur={bump(-1)}
    >
      {trigger}
      <span id={id} role="tooltip" className="r1-tip__bubble">
        {p.label}
      </span>
    </span>
  );
}

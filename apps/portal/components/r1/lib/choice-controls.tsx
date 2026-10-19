"use client";

import type * as React from "react";
import { Icon } from "../Icon";

// The mark every checkbox and radio draws: the real input stays in place for the keyboard and screen readers.
export function choiceMark(
  type: "checkbox" | "radio",
  attrs: React.InputHTMLAttributes<HTMLInputElement>,
  indeterminate?: boolean,
): React.ReactElement[] {
  return [
    <input
      key="i"
      type={type}
      className="r1-check__input"
      ref={
        type === "checkbox"
          ? function (el: HTMLInputElement | null) {
              if (el) el.indeterminate = !!indeterminate;
            }
          : undefined
      }
      {...attrs}
    />,
    <span key="b" className={type === "radio" ? "r1-radio__dot" : "r1-check__box"} aria-hidden="true">
      {type === "radio" ? null : <Icon name={indeterminate ? "minus" : "check"} size={12} strokeWidth={3} />}
    </span>,
  ];
}

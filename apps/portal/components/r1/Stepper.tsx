"use client";

import type * as React from "react";
import { createElement } from "react";
import { Icon } from "./Icon";
import { formatTimestamp } from "./lib/formatting";
import { cx } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type StepperProps = {
  steps: {
    label: string;
    state?: "done" | "current" | "todo" | "blocked" | undefined;
    reason?: string | undefined;
    href?: string | undefined;
    onClick?: (() => void) | undefined;
  }[];
  savedAt?: string | Date | undefined;
  label?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Each step says its state in words as well as by its mark. A done step with href or onClick is a way back to
// change it; a blocked step states its reason under the label. The saved line is a status, read when it changes.
export function Stepper(p: StepperProps) {
  const t = tx(p.locale);
  const steps = p.steps || [];
  return (
    <nav className={cx("r1-stepper", p.className)} aria-label={p.label || t.step} style={p.style}>
      <ol className="r1-stepper__list">
        {steps.map(function (s, i) {
          const state = s.state || "todo";
          const mark =
            state === "done" ? (
              <Icon name="check" size={16} />
            ) : state === "blocked" ? (
              <Icon name="ban" size={16} />
            ) : (
              <span>{String(i + 1)}</span>
            );
          // aria-current already says "current step"; the other states are said in words.
          const words = [
            s.label,
            state === "current" ? null : (
              <span key="sr" className="r1-sr">
                {", " + t.stepper[state]}
              </span>
            ),
          ];
          const back = state === "done" && (s.href || s.onClick);
          const label = back ? (
            createElement(
              s.href ? "a" : "button",
              {
                className: "r1-step__label r1-step__link",
                href: s.href,
                type: s.href ? undefined : "button",
                onClick: s.onClick,
              },
              words,
            )
          ) : (
            <span className="r1-step__label">{words}</span>
          );
          return (
            <li
              key={i}
              className={cx("r1-step", "r1-step--" + state)}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="r1-step__mark" aria-hidden="true">
                {mark}
              </span>
              {state === "blocked" && s.reason ? (
                <span className="r1-step__text">
                  {label}
                  <span className="r1-step__reason">{s.reason}</span>
                </span>
              ) : (
                label
              )}
            </li>
          );
        })}
      </ol>
      {
        // The date, the time and the zone, so a draft saved on another day is not read as saved today.
        p.savedAt ? (
          <p className="r1-stepper__saved" role="status">
            <Icon name="check" size={16} />
            {t.savedAt + " " + String(formatTimestamp(p.savedAt, p.locale) || p.savedAt)}
          </p>
        ) : null
      }
    </nav>
  );
}

"use client";

import type * as React from "react";
import { createElement } from "react";
import { cx } from "./lib/helpers";
import type { Locale } from "./lib/types";

export type NumberedStepsProps = {
  title?: string | undefined;
  level?: 2 | 3 | undefined;
  steps: React.ReactNode[];
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Instructions in order, each a sentence. On the Player the sizes follow the frame.
export function NumberedSteps(p: NumberedStepsProps) {
  const steps = p.steps || [];
  return (
    <section className={cx("r1-nsteps", p.className)} style={p.style}>
      {p.title ? createElement(p.level === 3 ? "h3" : "h2", { className: "r1-nsteps__title" }, p.title) : null}
      <ol className="r1-nsteps__list">
        {steps.map(function (s, i) {
          return (
            <li key={i} className="r1-nsteps__item">
              <span className="r1-nsteps__n r1-num" aria-hidden="true">
                {String(i + 1)}
              </span>
              <span className="r1-nsteps__text">{s}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { StatusIcon } from "./StatusIcon";
import { keepRefs } from "./lib/button";
import { cx, isNil } from "./lib/helpers";
import { typedValue } from "./lib/side-by-side-lineage";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type TracePathProps = {
  steps: {
    label: string;
    value: React.ReactNode;
    href?: string | undefined;
    detail?: string | undefined;
    /** as in Comparison rows */ kind?:
      "text" | "money" | "count" | "percent" | "date" | "datetime" | "period" | "id" | undefined;
    currency?: string | undefined;
    unit?: string | undefined;
    missing?: string | undefined;
    decimals?: number | undefined;
    /** gap: a missing link (dashed connector into it, attention shape and words); pending: a link not reached yet (hollow neutral ring, secondary words) */ state?:
      "gap" | "pending" | undefined;
  }[];
  label?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Where a figure comes from, step by step: input, class, band, rule, amount. Each step can open its source.
// Each step keeps its own width and the path wraps between steps, never squeezing a step's words: the chevron that
// leads to the next step ends the step before it, so a row that wraps ends on a chevron and the next row starts with
// a step. state (opt-in): 'gap', a link that is missing (a dashed connector into it, the attention shape, its words in
// attention-text), or 'pending', a link not reached yet (the neutral hollow ring, its words in secondary text); the
// words themselves say what is missing or what it waits for. A reference that opens its record (kind 'id' with href)
// is drawn as text inside the link, so it takes the link's underline and holds no copy control.
export function TracePath(p: TracePathProps) {
  const t = tx(p.locale);
  const steps = p.steps || [];
  return (
    <ol className={cx("r1-trace", p.className)} aria-label={p.label || t.trace.label} style={p.style}>
      {steps.map(function (s, i) {
        const state = s.state === "gap" || s.state === "pending" ? s.state : null;
        const next = steps[i + 1];
        const intoGap = !!next && next.state === "gap";
        const linkedRef = !!s.href && s.kind === "id" && !isNil(s.value) && s.value !== "";
        const value = linkedRef ? (
          <span className="r1-mono r1-nowrap">{s.value}</span>
        ) : (
          typedValue(s.kind, s.value, s, p.locale)
        );
        const shown = s.href ? (
          <a className="r1-link r1-trace__value" href={s.href}>
            {value}
          </a>
        ) : (
          <span className="r1-trace__value">{value}</span>
        );
        return (
          <li key={i} className={cx("r1-trace__step", state && "r1-trace__step--" + state)}>
            <span className="r1-trace__body">
              <span className="r1-trace__kind">{s.label}</span>
              {state ? (
                <span className="r1-trace__line">
                  <StatusIcon family={state === "gap" ? "attention" : "neutral"} size={16} cutout="surface" />
                  {shown}
                </span>
              ) : (
                shown
              )}
              {s.detail ? <span className="r1-trace__detail">{keepRefs(s.detail)}</span> : null}
            </span>
            {next ? (
              <span className={cx("r1-trace__sep", intoGap && "r1-trace__sep--gap")} aria-hidden="true">
                {intoGap ? <span className="r1-trace__dash" /> : null}
                <Icon name="chevron-right" size={16} />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

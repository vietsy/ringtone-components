"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { formatCount } from "./lib/formatting";
import { cx, isNil, useSynced, useUid } from "./lib/helpers";
import type { Locale } from "./lib/types";

export type SegmentedControlProps = {
  options: {
    value: string;
    label: string;
    count?: number | undefined;
    disabled?: boolean | undefined;
    reason?: string | undefined;
  }[];
  value?: string | undefined;
  label: string;
  hideLabel?: boolean | undefined;
  density?: "console" | "portal" | "premises" | undefined;
  onChange?: ((value: string) => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Two to seven mutually exclusive views of the same list. Arrow keys move between options; the chosen one is
// the tab stop, or the first enabled one when no option matches the value. A disabled option says why in a
// line under the control. The choice is the control's own state, reset whenever the page passes a new value.
export function SegmentedControl(p: SegmentedControlProps) {
  const id = useUid("r1-seg");
  const opts = p.options || [];
  const st = useSynced(p.value, null);
  const current = st[0];
  const enabled = opts.filter(function (o) {
    return !o.disabled;
  });
  const stop = enabled.some(function (o) {
    return o.value === current;
  })
    ? current
    : enabled[0] && enabled[0].value;
  function pick(v: string) {
    st[1](v);
    if (p.onChange) p.onChange(v);
  }
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) < 0) return;
    e.preventDefault();
    const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>(".r1-seg__opt:not([disabled])");
    const list = Array.prototype.slice.call(btns) as HTMLButtonElement[];
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = list[(at + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? list.length - 1 : 1)) % list.length];
    if (next) {
      next.focus();
      next.click();
    }
  }
  const why: React.ReactElement[] = [];
  const group = (
    <div
      className={cx("r1-seg", "r1-seg--" + (p.density || "console"))}
      role="radiogroup"
      onKeyDown={onKey}
      aria-labelledby={p.label && !p.hideLabel ? id : undefined}
      aria-label={p.hideLabel ? p.label : undefined}
    >
      {opts.map(function (o, i) {
        const on = o.value === current;
        const rid = o.disabled && o.reason ? id + "-why-" + i : undefined;
        if (rid)
          why.push(
            <p key={i} id={rid} className="r1-field__reason">
              <Icon name="info" size={16} />
              <span>{o.label + ": " + o.reason}</span>
            </p>,
          );
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on ? "true" : "false"}
            tabIndex={o.value === stop ? 0 : -1}
            className="r1-seg__opt"
            disabled={o.disabled}
            aria-describedby={rid}
            onClick={function () {
              pick(o.value);
            }}
          >
            <span>{o.label}</span>
            {isNil(o.count) ? null : <span className="r1-seg__count r1-num">{formatCount(o.count, p.locale)}</span>}
          </button>
        );
      })}
    </div>
  );
  return (
    <div className={cx("r1-field r1-seg-field", p.className)} style={p.style}>
      {p.label && !p.hideLabel ? (
        <span id={id} className="r1-field__label">
          {p.label}
        </span>
      ) : null}
      {group}
      {why.length ? <div className="r1-seg__why">{why}</div> : null}
    </div>
  );
}

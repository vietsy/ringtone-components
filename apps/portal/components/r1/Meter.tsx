"use client";

import type * as React from "react";
import { cx, isNil, textOf } from "./lib/helpers";
import { STATUS_FAMILIES } from "./lib/icons";
import { tx } from "./lib/strings";
import type { Family, Locale } from "./lib/types";

// A measured amount beside its absolute numbers. A missing value is not zero: no fill, a dashed track, and it
// is said as "no value". The fill is the family's fill token with an edge in its text token, so the filled part
// stands at least 3:1 from the track in every family (amber-400 alone is 1.5:1 on it). valueText is what a
// screen reader says; by default the ring's centre text or the bar's caption.
function meterTokens(family: string): [string, string] {
  return family === "accent" ? ["accent", "accent-strong"] : [family + "-fill", family + "-text"];
}

export type MeterProps = {
  value: number | null;
  max?: number | undefined;
  variant?: "bar" | "ring" | undefined;
  family?: Family | "accent" | undefined;
  label?: string | undefined;
  valueText?: string | undefined;
  caption?: string | undefined;
  thickness?: number | undefined;
  /** bar: a ceiling or a floor, a tick across the track with its label under it; the label is read after the value */ marker?:
    | {
        value: number;
        label?: string | undefined;
      }
    | undefined;
  size?: number | undefined;
  stroke?: number | undefined;
  centerLabel?: string | undefined;
  centerSub?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function Meter(p: MeterProps) {
  const t = tx(p.locale);
  const max = p.max || 100;
  const none = isNil(p.value) || isNaN(Number(p.value));
  const pct = none ? 0 : Math.max(0, Math.min(100, Math.round((Number(p.value) / max) * 100)));
  const family =
    p.family === "accent" || (STATUS_FAMILIES as readonly (string | undefined)[]).indexOf(p.family) >= 0
      ? p.family!
      : "info";
  const said = p.valueText || [p.centerLabel, p.centerSub].filter(Boolean).join(" ") || p.caption || undefined;
  // marker (bar): a ceiling or a floor, { value, label }, a tick across the track with its label under it. The label is
  // read after the value ("…, Mức sàn 85 %"), so the drawn copy is hidden from a screen reader.
  const mk =
    p.variant !== "ring" && p.marker && !isNil(p.marker.value) && !isNaN(Number(p.marker.value)) ? p.marker : null;
  const mpct = mk ? Math.max(0, Math.min(100, (Number(mk.value) / max) * 100)) : 0;
  const heard =
    mk && mk.label ? [said, textOf(mk.label)].filter(Boolean).join(said && /[.!?]$/.test(said) ? " " : ". ") : said;
  const a11y = none
    ? {
        role: "img",
        "aria-label": (p.label ? p.label + ": " : "") + t.noValue + (mk && mk.label ? ". " + textOf(mk.label) : ""),
      }
    : {
        role: "meter",
        "aria-valuenow": Number(p.value),
        "aria-valuemin": 0,
        "aria-valuemax": max,
        "aria-valuetext": heard,
        "aria-label": p.label,
      };
  if (p.variant === "ring") {
    const size = p.size || 240,
      stroke = p.stroke || Math.max(10, Math.round(size / 16));
    const r = (size - stroke) / 2,
      c = 2 * Math.PI * r,
      mid = size / 2,
      tok = meterTokens(family);
    const arc = function (key: string, colour: string, width: number) {
      return (
        <circle
          key={key}
          cx={mid}
          cy={mid}
          r={r}
          transform={"rotate(-90 " + mid + " " + mid + ")"}
          style={{
            fill: "none",
            stroke: "var(--" + colour + ")",
            strokeWidth: width,
            strokeLinecap: "round",
            strokeDasharray: (c * pct) / 100 + " " + c,
          }}
        />
      );
    };
    return (
      <div
        className={cx("r1-ring", none && "r1-ring--none", p.className)}
        style={Object.assign({ width: size, height: size }, p.style)}
        {...a11y}
      >
        <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} aria-hidden="true">
          <circle
            cx={mid}
            cy={mid}
            r={r}
            style={{ fill: "none", stroke: "var(--surface-sunken)", strokeWidth: stroke }}
          />
          {none || !pct ? null : [arc("e", tok[1], stroke), arc("f", tok[0], Math.max(1, stroke - 2))]}
        </svg>
        <div className="r1-ring__center" aria-hidden="true">
          {p.centerLabel ? (
            <span className="r1-ring__value r1-num">{none ? "–" : p.centerLabel}</span>
          ) : none ? (
            <span className="r1-ring__value r1-num">–</span>
          ) : null}
          {p.centerSub ? <span className="r1-ring__sub">{p.centerSub}</span> : null}
        </div>
      </div>
    );
  }
  const track = (
    <div
      className={cx("r1-meter", "r1-meter--" + family, none && "r1-meter--none")}
      style={p.thickness ? { height: p.thickness } : undefined}
      {...a11y}
    >
      {none ? null : <span className="r1-meter__fill" style={{ width: pct + "%" }} />}
    </div>
  );
  // The label starts at the tick, or ends at it past the middle of the track, so it never runs out of the bar's width.
  const past = mpct > 50;
  return (
    <div className={cx("r1-meterbox", mk && "r1-meterbox--marked", p.className)} style={p.style}>
      {p.caption ? (
        <div className="r1-meterbox__caption" aria-hidden={said === p.caption ? "true" : undefined}>
          {p.caption}
        </div>
      ) : null}
      {mk ? (
        <div className="r1-meter__frame">
          {track}
          <span className="r1-meter__tick" style={{ left: mpct + "%" }} aria-hidden="true" />
        </div>
      ) : (
        track
      )}
      {mk && mk.label ? (
        <div
          className={cx("r1-meter__mark", past && "r1-meter__mark--end")}
          style={past ? { paddingRight: 100 - mpct + "%" } : { paddingLeft: mpct + "%" }}
          aria-hidden="true"
        >
          <span className="r1-meter__mark-label">{mk.label}</span>
        </div>
      ) : null}
    </div>
  );
}

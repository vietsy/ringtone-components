"use client";

import type * as React from "react";
import { cx } from "./lib/helpers";
import { clockOf, hashOf, positionText } from "./lib/player-parts";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type WaveRingProps = {
  elapsed: number;
  duration: number;
  size?: number | undefined;
  paused?: boolean | undefined;
  title?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The same position drawn around a square slot. Its times never fall below text-lg, whatever the size.
export function WaveRing(p: WaveRingProps) {
  const t = tx(p.locale);
  const S = p.size || 256,
    c = S / 2;
  const dur = p.duration || 0,
    at = Math.min(dur, p.elapsed || 0),
    f = dur ? at / dur : 0;
  const stroke = Math.max(3, Math.round(S / 85));
  const ro = c - stroke * 3;
  const rw = ro - Math.round(S * 0.07);
  const rc = Math.round(S * 0.26);
  let seed = hashOf(p.title || "r1");
  const lines: { x1: number; y1: number; x2: number; y2: number; lit: boolean }[] = [];
  const nr = Math.round(S / 4.4),
    r0 = rc + Math.round(S * 0.035),
    band = rw - r0;
  for (let i = 0; i < nr; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const a = ((-90 + (360 * (i + 0.5)) / nr) * Math.PI) / 180;
    const env = 0.3 + 0.7 * Math.pow(Math.sin((Math.PI * ((i * 7) % nr)) / nr), 2);
    const len = Math.max(3, band * env * (0.45 + (((seed >>> 8) % 1000) / 1000) * 0.55));
    lines.push({
      x1: c + r0 * Math.cos(a),
      y1: c + r0 * Math.sin(a),
      x2: c + (r0 + len) * Math.cos(a),
      y2: c + (r0 + len) * Math.sin(a),
      lit: (i + 0.5) / nr <= f,
    });
  }
  const ang = ((-90 + 360 * f) * Math.PI) / 180;
  const circ = 2 * Math.PI * ro;
  function typeAt(share: number): string {
    return "max(var(--text-lg), calc(var(--spacing) * " + ((S * share) / 4).toFixed(2) + "))";
  }
  return (
    <div
      className={cx("r1-wave", p.paused && "r1-wave--paused", p.className)}
      style={Object.assign({ width: S, height: S }, p.style)}
      role="progressbar"
      aria-label={t.deck.position}
      aria-valuemin={0}
      aria-valuemax={dur}
      aria-valuenow={at}
      aria-valuetext={positionText(at, dur, p.locale)}
    >
      <svg width={S} height={S} viewBox={"0 0 " + S + " " + S} aria-hidden="true" focusable="false">
        <circle cx={c} cy={c} r={ro} className="r1-wave__track" style={{ strokeWidth: stroke }} />
        {lines.map(function (l, i) {
          return (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              className={l.lit ? "r1-wave__bar r1-wave__bar--lit" : "r1-wave__bar"}
              style={{ strokeWidth: Math.max(2, S / 120) }}
            />
          );
        })}
        <circle cx={c} cy={c} r={rc} className="r1-wave__disc" />
        <circle
          cx={c}
          cy={c}
          r={ro}
          className="r1-wave__arc"
          transform={"rotate(-90 " + c + " " + c + ")"}
          style={{ strokeWidth: stroke + 1, strokeDasharray: circ * f + " " + circ }}
        />
        <circle cx={c + ro * Math.cos(ang)} cy={c + ro * Math.sin(ang)} r={stroke * 2.4} className="r1-wave__knob" />
      </svg>
      <div className="r1-wave__time r1-num" aria-hidden="true">
        <span className="r1-wave__at" style={{ fontSize: typeAt(0.1) }}>
          {clockOf(at)}
        </span>
        <span className="r1-wave__rule" />
        <span className="r1-wave__dur" style={{ fontSize: typeAt(0.075) }}>
          {clockOf(dur)}
        </span>
      </div>
    </div>
  );
}

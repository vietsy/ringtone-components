"use client";

import type * as React from "react";
import { cx } from "./lib/helpers";
import { clockOf, hashOf, positionText } from "./lib/player-parts";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type WaveBarProps = {
  elapsed: number;
  duration: number;
  paused?: boolean | undefined;
  title?: string | undefined;
  bars?: number | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The track position: the track's waveform lit up to the play position, with elapsed and total time under its ends.
// The gap between bars is a share of the width, so the bars always fit the frame they are in.
export function WaveBar(p: WaveBarProps) {
  const t = tx(p.locale);
  const dur = p.duration || 0,
    at = Math.min(dur, p.elapsed || 0),
    f = dur ? at / dur : 0;
  const n = p.bars || 96;
  let seed = hashOf(p.title || "r1");
  const bars: { h: number; lit: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const env = 0.35 + 0.65 * Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 0.6);
    bars.push({ h: Math.round(100 * env * (0.35 + (((seed >>> 8) % 1000) / 1000) * 0.65)), lit: (i + 0.5) / n <= f });
  }
  return (
    <div
      className={cx("r1-wavebar", p.paused && "r1-wavebar--paused", p.className)}
      style={p.style}
      role="progressbar"
      aria-label={t.deck.position}
      aria-valuemin={0}
      aria-valuemax={dur}
      aria-valuenow={at}
      aria-valuetext={positionText(at, dur, p.locale)}
    >
      <div className="r1-wavebar__bars" aria-hidden="true" style={{ columnGap: "calc(50% / " + n + ")" }}>
        {bars.map(function (b, k) {
          return (
            <span
              key={k}
              className={b.lit ? "r1-wavebar__bar r1-wavebar__bar--lit" : "r1-wavebar__bar"}
              style={{ height: Math.max(8, b.h) + "%" }}
            />
          );
        })}
      </div>
      <div className="r1-wavebar__times r1-num" aria-hidden="true">
        <span>{clockOf(at)}</span>
        <span>{clockOf(dur)}</span>
      </div>
    </div>
  );
}

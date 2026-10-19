"use client";

import type * as React from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { cx } from "./lib/helpers";
import { clockOf } from "./lib/player-parts";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type AudioRecorderProps = {
  state?: "idle" | "recording" | "recorded" | "denied" | undefined;
  elapsed?: number | undefined;
  max?: number | undefined;
  levels?: number[] | undefined;
  note?: string | undefined;
  keepLabel?: string | undefined;
  /** recorded: the recording is being kept; Keep is busy */ loading?: boolean | undefined;
  onStart?: (() => void) | undefined;
  onStop?: (() => void) | undefined;
  onKeep?: (() => void) | undefined;
  onDiscard?: (() => void) | undefined;
  label?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A short recording made on the spot, with its length limit, its level and what happens to it stated before it starts.
export function AudioRecorder(p: AudioRecorderProps) {
  const t = tx(p.locale).rec;
  const state = p.state || "idle";
  const max = p.max || 30,
    el = Math.min(p.elapsed || 0, max);
  const levels = p.levels || [];
  return (
    <section className={cx("r1-rec", "r1-rec--" + state, p.className)} aria-label={p.label || t.label} style={p.style}>
      <div className="r1-rec__main">
        {state === "recording" ? (
          <button type="button" className="r1-rec__button r1-rec__button--stop" aria-label={t.stop} onClick={p.onStop}>
            <Icon name="square" size={20} />
          </button>
        ) : (
          <button
            type="button"
            className="r1-rec__button"
            aria-label={state === "recorded" ? t.again : state === "denied" ? t.retry : t.start}
            onClick={p.onStart}
          >
            <Icon name={state === "denied" ? "refresh-cw" : "mic"} size={20} />
          </button>
        )}
        <div className="r1-rec__readout">
          <span className="r1-rec__state" role="status">
            {{ idle: t.idle, recording: t.recording, recorded: t.recorded, denied: t.denied }[state]}
          </span>
          <span className="r1-rec__time r1-num">{clockOf(el) + " / " + clockOf(max)}</span>
          {state === "recording" || state === "recorded" ? (
            <span className="r1-rec__levels" aria-hidden="true">
              {levels.map(function (v, i) {
                return (
                  <span key={i} className="r1-rec__lvl" style={{ height: Math.max(8, Math.round(v * 100)) + "%" }} />
                );
              })}
            </span>
          ) : null}
        </div>
      </div>
      {p.note ? <p className="r1-rec__note">{p.note}</p> : null}
      {state === "recorded" ? (
        <div className="r1-rec__actions">
          <Button variant="primary" size="lg" loading={!!p.loading} onClick={p.onKeep} locale={p.locale}>
            {p.keepLabel || t.keep}
          </Button>
          <Button variant="quiet" size="lg" onClick={p.onDiscard} locale={p.locale}>
            {t.discard}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

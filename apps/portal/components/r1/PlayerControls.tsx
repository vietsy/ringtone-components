"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { WaveBar } from "./WaveBar";
import { cx, isControl, isNil, lang, useLatest, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type PlayerControlsProps = {
  elapsed: number;
  duration: number;
  paused?: boolean | undefined;
  volume?: number | undefined;
  muted?: boolean | undefined;
  progress?: boolean | undefined;
  title?: string | undefined;
  bars?: number | undefined;
  transport?: boolean | undefined;
  previous?: boolean | undefined;
  previousReason?: string | undefined;
  fullscreen?: boolean | undefined;
  shortcuts?: boolean | undefined;
  onToggle?: (() => void) | undefined;
  onPrevious?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  onFullscreen?: (() => void) | undefined;
  onVolume?: ((volume: number) => void) | undefined;
  onMute?: ((muted: boolean) => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Previous stays visible but off: FR-PLR-019 bars a repeat within the premises local day, and a
// previous track has by definition played today. Next asks ALG-195 for the next track now.
export function PlayerControls(p: PlayerControlsProps) {
  const t = tx(p.locale);
  const reasonId = useUid("r1-prev");
  const dur = p.duration || 0,
    at = Math.min(dur, p.elapsed || 0);
  const volSt = useSynced(p.volume, 70);
  const muteSt = useSynced(isNil(p.muted) ? undefined : !!p.muted, false);
  const vol = volSt[0];
  const muted = muteSt[0];
  const latest = useLatest(p);
  const trackRef = useRef<HTMLDivElement>(null);
  function setVol(v: number) {
    const x = Math.max(0, Math.min(100, Math.round(v)));
    volSt[1](x);
    if (latest.current.onVolume) latest.current.onVolume(x);
  }
  function toggleMute() {
    const m = !muted;
    muteSt[1](m);
    if (p.onMute) p.onMute(m);
  }
  function onSliderKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const d = (
      { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 10, PageDown: -10 } as Record<string, number>
    )[e.key];
    if (!isNil(d)) {
      e.preventDefault();
      setVol(vol + d);
    } else if (e.key === "Home") {
      e.preventDefault();
      setVol(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setVol(100);
    }
  }
  function fromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const box = trackRef.current && trackRef.current.getBoundingClientRect();
    if (box && box.width) setVol(((e.clientX - box.left) / box.width) * 100);
  }
  // On the staff screen, while music plays: Space pauses or resumes, arrows set the volume, N skips, F fills the screen.
  useEffect(
    function () {
      if (!p.shortcuts) return undefined;
      function onKey(e: KeyboardEvent) {
        if (e.ctrlKey || e.metaKey || e.altKey || isControl(e.target)) return;
        const q = latest.current;
        if (e.key === " " && q.onToggle) {
          e.preventDefault();
          q.onToggle();
        } else if ((e.key === "n" || e.key === "N") && q.onNext) q.onNext();
        else if ((e.key === "f" || e.key === "F") && q.fullscreen && q.onFullscreen) q.onFullscreen();
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          setVol(volRef.current + (e.key === "ArrowUp" ? 5 : -5));
        }
      }
      document.addEventListener("keydown", onKey);
      return function () {
        document.removeEventListener("keydown", onKey);
      };
    },
    [!!p.shortcuts],
  );
  const volRef = useLatest(vol);
  const paused = !!p.paused;
  const transport = !!p.transport;
  // Previous is always off, whatever `previous` says: turning it on would break the once-a-day rule.
  const prevOff = transport;
  const play = (
    <button
      type="button"
      className="r1-deck__play"
      aria-label={paused ? t.deck.play : t.deck.pause}
      onClick={p.onToggle}
    >
      <Icon name={paused ? "play" : "pause"} size={32} strokeWidth={2} />
    </button>
  );
  return (
    <div
      className={cx("r1-deck", paused && "r1-deck--paused", transport && "r1-deck--transport", p.className)}
      style={p.style}
    >
      {
        // The position is drawn by WaveBar everywhere, so it reads and sounds the same on every screen.
        p.progress === false ? null : (
          <WaveBar elapsed={at} duration={dur} paused={paused} title={p.title} bars={p.bars} locale={p.locale} />
        )
      }
      {transport ? (
        <div className="r1-deck__transport">
          <div className="r1-deck__buttons">
            <button
              type="button"
              className="r1-deck__skip"
              aria-label={t.deck.previous}
              aria-disabled={prevOff ? "true" : undefined}
              aria-describedby={prevOff ? reasonId : undefined}
              onClick={prevOff ? undefined : p.onPrevious}
            >
              <Icon name="skip-back" size={28} strokeWidth={2} />
            </button>
            {play}
            <button type="button" className="r1-deck__skip" aria-label={t.deck.next} onClick={p.onNext}>
              <Icon name="skip-forward" size={28} strokeWidth={2} />
            </button>
          </div>
          {prevOff ? (
            <p id={reasonId} className="r1-deck__reason">
              {p.previousReason || t.deck.previousOff}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="r1-deck__row">
        {transport ? null : play}
        <div className={cx("r1-deck__volume", muted && "r1-deck__volume--muted")}>
          <button
            type="button"
            className="r1-deck__mute"
            aria-label={muted ? t.deck.unmute : t.deck.mute}
            aria-pressed={muted ? "true" : "false"}
            onClick={toggleMute}
          >
            <Icon name={muted ? "volume-x" : "volume-2"} size={28} />
          </button>
          <div
            ref={trackRef}
            className="r1-deck__slider"
            role="slider"
            tabIndex={0}
            aria-label={t.deck.volume}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={vol}
            aria-valuetext={vol + (lang(p.locale) === "en" ? "%" : "\u00a0%")}
            onKeyDown={onSliderKey}
            onPointerDown={function (e) {
              if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
              fromPointer(e);
            }}
            onPointerMove={function (e) {
              if (e.buttons) fromPointer(e);
            }}
          >
            <span className="r1-deck__fill" style={{ width: vol + "%" }} />
            <span className="r1-deck__knob" style={{ left: vol + "%" }} />
          </div>
          <span className="r1-deck__vol r1-num" aria-hidden="true">
            {vol + (lang(p.locale) === "en" ? "%" : "\u00a0%")}
          </span>
        </div>
        {p.fullscreen ? (
          <button type="button" className="r1-deck__full" onClick={p.onFullscreen}>
            <Icon name="maximize" size={24} />
            <span>{t.deck.fullscreen}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

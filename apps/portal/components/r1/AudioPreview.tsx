"use client";

import type * as React from "react";
import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { announce, cx, isNil, useSynced } from "./lib/helpers";
import { clockOf } from "./lib/player-parts";
import { tx } from "./lib/strings";
import type { Locale, OnValue } from "./lib/types";

export type AudioPreviewProps = {
  title: string;
  by?: string | undefined;
  src?: string | undefined;
  duration?: number | undefined;
  elapsed?: number | undefined;
  playing?: boolean | undefined;
  clip?: string | undefined;
  unavailable?: boolean | string | undefined;
  /** a playback failure: true for the standard sentence, or the page's own; the button stays to try again */ error?:
    boolean | string | undefined;
  onToggle?: ((playing: boolean) => void) | undefined;
  onSeek?: OnValue<number> | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A short listen to a track in a portal: play, where it is, how long it is. Not the Player.
// With src it plays the file; without, it is driven by the page through playing and elapsed.
// onToggle(playing) and onSeek(seconds, event) report what the reader did.
export function AudioPreview(p: AudioPreviewProps) {
  const t = tx(p.locale).audio;
  const playing = useSynced(isNil(p.playing) ? undefined : !!p.playing, false);
  const pos = useSynced(p.elapsed, 0);
  const len = useSynced(p.duration, 0);
  const fl = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const dur = len[0] || 0,
    el = Math.min(pos[0] || 0, dur);
  const pct = dur ? Math.round((el / dur) * 1000) / 10 : 0;
  // A file that will not play says so under the title, and the button stays to try again. error: the page's own
  // playback failure (true for the standard sentence, or its own sentence).
  const errorText = fl[0] ? t.failed : p.error ? (typeof p.error === "string" ? p.error : t.failed) : null;
  function failed() {
    playing[1](false);
    fl[1](true);
    announce(t.failed);
    if (p.onToggle) p.onToggle(false);
  }
  function toggle() {
    const next = !playing[0];
    playing[1](next);
    fl[1](false);
    const a = audioRef.current;
    if (a) {
      if (next) {
        const r = a.play() as Promise<void> | undefined;
        if (r && r.catch) r.catch(failed);
      } else a.pause();
    }
    if (p.onToggle) p.onToggle(next);
  }
  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    pos[1](v);
    if (audioRef.current) audioRef.current.currentTime = v;
    if (p.onSeek) p.onSeek(v, e);
  }
  if (p.unavailable) {
    return (
      <div className={cx("r1-audio r1-audio--off", p.className)} style={p.style}>
        <span className="r1-audio__play r1-audio__play--off" aria-hidden="true">
          <Icon name="music" size={16} />
        </span>
        <div className="r1-audio__body">
          <div className="r1-audio__line">
            <span className="r1-audio__title">{p.title}</span>
            {p.by ? <span className="r1-audio__by">{p.by}</span> : null}
          </div>
          <span className="r1-audio__clip">{typeof p.unavailable === "string" ? p.unavailable : t.unavailable}</span>
        </div>
      </div>
    );
  }
  return (
    <div
      className={cx("r1-audio", playing[0] && "r1-audio--playing", errorText && "r1-audio--failed", p.className)}
      role="group"
      aria-label={t.label + ": " + p.title}
      style={p.style}
    >
      {p.src ? (
        <audio
          ref={audioRef}
          src={p.src}
          preload="metadata"
          onLoadedMetadata={function (e) {
            if (isFinite((e.target as HTMLAudioElement).duration)) len[1]((e.target as HTMLAudioElement).duration);
          }}
          onTimeUpdate={function (e) {
            pos[1]((e.target as HTMLAudioElement).currentTime);
          }}
          onEnded={function () {
            playing[1](false);
            if (p.onToggle) p.onToggle(false);
          }}
          onError={failed}
        />
      ) : null}
      <button
        type="button"
        className="r1-audio__play"
        aria-label={(playing[0] ? t.pause : t.play) + ": " + p.title}
        aria-pressed={playing[0] ? "true" : "false"}
        onClick={toggle}
      >
        <Icon name={playing[0] ? "pause" : "play"} size={16} />
      </button>
      <div className="r1-audio__body">
        <div className="r1-audio__line">
          <span className="r1-audio__title">{p.title}</span>
          {p.by ? <span className="r1-audio__by">{p.by}</span> : null}
        </div>
        <div className="r1-audio__track">
          <span className="r1-audio__bar" aria-hidden="true">
            <span className="r1-audio__fill" style={{ width: pct + "%" }} />
          </span>
          <input
            type="range"
            className="r1-audio__range"
            min={0}
            max={dur}
            step={1}
            value={Math.round(el)}
            onChange={seek}
            aria-label={t.position}
            aria-valuetext={clockOf(el) + " / " + clockOf(dur)}
          />
          <span className="r1-audio__time r1-num">{clockOf(el) + " / " + clockOf(dur)}</span>
        </div>
        {errorText ? (
          <span className="r1-audio__msg">{errorText}</span>
        ) : p.clip ? (
          <span className="r1-audio__clip">{p.clip}</span>
        ) : null}
      </div>
    </div>
  );
}

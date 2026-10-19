"use client";

import type * as React from "react";
import { useState } from "react";
import { Icon } from "./Icon";
import { cx } from "./lib/helpers";
import { hashOf, toneOf } from "./lib/player-parts";
import { tx } from "./lib/strings";
import type { Locale, Tone } from "./lib/types";

// A small state mark in the cover's corner, never a centred glyph that reads as a button. The guest display, where
// nothing is a control and the title line already says the music is paused, shows none.
function pauseMark(display: boolean) {
  return display ? null : (
    <span className="r1-art__pause r1-art__pause--over" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

export type ArtworkProps = {
  title?: string | undefined;
  by?: string | undefined;
  src?: string | undefined;
  alt?: string | undefined;
  size?: number | undefined;
  variant?: "groove" | undefined;
  state?: "shown" | "unavailable" | "paused" | undefined;
  scale?: "device" | "display" | undefined;
  /** the track tone of a groove or text cover (Figma's Tone, teal or blue): a screen that knows the track's tone sets it;
   * left out, the title picks it as before. Tone=None is a state, not a choice: the paused text cover and the placeholder
   * draw no tone whatever this says */ tone?: Tone | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

/** An inline style that also sets CSS custom properties ("--art-type"). */
type StyleWithVars = React.CSSProperties & { [name: `--${string}`]: string | number | undefined };

export function Artwork(p: ArtworkProps) {
  const t = tx(p.locale);
  // A catalogue image that fails to load is a missing cover: it says so instead of showing a broken image.
  // It remembers which src failed, so a new src is tried again without an effect racing the error.
  const failSt = useState<string | null | undefined>(null);
  const size = p.size || 320;
  let state = p.state || "shown";
  const src = p.src && failSt[0] !== p.src ? p.src : null;
  if (p.src && !src && state !== "paused") state = "unavailable";
  const box = Object.assign<StyleWithVars, React.CSSProperties | undefined>({ width: size, height: size }, p.style);
  const display = p.scale === "display";
  // A tone the type does not know (a retired name from untyped code) falls back to the title's own, as PlayerFrame does.
  const tone: Tone = p.tone === "teal" || p.tone === "blue" ? p.tone : toneOf(p.title);
  const cls = cx("r1-art", display && "r1-art--display", p.className);
  const onError = function () {
    failSt[1](p.src);
  };
  // An image can fail before React is listening (the first render yields to the browser): check it once mounted.
  const checkImg = function (el: HTMLImageElement | null) {
    if (el && el.complete && el.naturalWidth === 0 && el.currentSrc) failSt[1](p.src);
  };
  if (state === "unavailable") {
    return (
      <div className={cx(cls, "r1-art--off")} style={box} role="img" aria-label={t.deck.artworkOff}>
        <Icon name="disc-3" size={Math.round(size / 5)} strokeWidth={1.5} />
        <span className="r1-art__offtext">{t.deck.artworkOff}</span>
      </div>
    );
  }
  if (src && state === "paused") {
    // The paused track keeps its cover, dimmed, under the pause mark.
    return (
      <div
        className={cx(cls, "r1-art--image", "r1-art--dim")}
        style={box}
        role="img"
        aria-label={t.deck.paused + (p.alt ? ": " + p.alt : "")}
      >
        <img ref={checkImg} className="r1-art__img" src={src} alt="" width={size} height={size} onError={onError} />
        {pauseMark(display)}
      </div>
    );
  }
  if (state === "paused" && !p.title) {
    return (
      <div className={cx(cls, "r1-art--paused")} style={box} role="img" aria-label={t.deck.paused}>
        {display ? (
          <Icon name="disc-3" size={Math.round(size / 5)} strokeWidth={1.5} />
        ) : (
          <span className="r1-art__pause" aria-hidden="true">
            <span />
            <span />
          </span>
        )}
      </div>
    );
  }
  if (src)
    return (
      <img
        ref={checkImg}
        className={cls}
        src={src}
        alt={p.alt || ""}
        width={size}
        height={size}
        style={p.style}
        onError={onError}
      />
    );
  // Stand-in drawn from the audio file itself, for places that already set the title beside it:
  // grooves from the rim inwards, each as heavy as that stretch of the track is loud.
  if (p.variant === "groove") {
    const c = size / 2,
      n = Math.round(size / 11),
      r0 = size * 0.15,
      r1 = size * 0.45,
      pitch = (r1 - r0) / n;
    const loud = loudOf(p.title, n),
      grooves: React.ReactElement[] = [];
    for (let g = 0; g < n; g++) {
      grooves.push(
        <circle
          key={g}
          cx={c}
          cy={c}
          r={r1 - pitch * (g + 0.5)}
          className="r1-art__groove"
          style={{ strokeWidth: Math.max(1, pitch * (0.2 + 0.6 * loud[g]!)), opacity: 0.3 + 0.65 * loud[g]! }}
        />,
      );
    }
    const still = state === "paused";
    return (
      <div
        className={cx(cls, "r1-art--groove", "r1-art--tone-" + tone, still && "r1-art--dim")}
        style={box}
        role="img"
        aria-label={still ? t.deck.paused : p.alt || t.deck.artwork + (p.title ? ": " + p.title : "")}
      >
        <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} aria-hidden="true" focusable="false">
          <g className="r1-art__grooves">{grooves}</g>
          <circle cx={c} cy={c} r={size * 0.1} className="r1-art__label" />
          <circle cx={c} cy={c} r={size * 0.015} className="r1-art__hole" />
        </svg>
        {still ? pauseMark(display) : null}
      </div>
    );
  }
  // Stand-in for the release image until the catalogue supplies one: the title set as a plain cover.
  // Its type is a sixth of the cover, never below text-lg.
  box["--art-type"] = "max(var(--text-lg), calc(var(--spacing) * " + (size / 26).toFixed(2) + "))";
  const paused = state === "paused";
  return (
    <div
      className={cx(cls, "r1-art--cover", "r1-art--tone-" + tone, paused && "r1-art--dim")}
      style={box}
      role="img"
      aria-label={paused ? t.deck.paused : p.alt || t.deck.artwork + (p.title ? ": " + p.title : "")}
    >
      <span className="r1-art__title">{p.title}</span>
      {p.by ? <span className="r1-art__by">{p.by}</span> : null}
      {paused ? pauseMark(display) : null}
    </div>
  );
}

// A smooth loudness curve for a track, seeded by its title: the same track always draws the same shape.
function loudOf(title: string | undefined, n: number): number[] {
  let seed = hashOf(title || "r1");
  const rnd = function () {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return ((seed >>> 8) % 1000) / 1000;
  };
  const p1 = rnd(),
    p2 = rnd(),
    p3 = rnd(),
    out: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n;
    let v =
      0.55 +
      0.22 * Math.sin(2 * Math.PI * (x * 1.4 + p1)) +
      0.14 * Math.sin(2 * Math.PI * (x * 3.3 + p2)) +
      0.08 * Math.sin(2 * Math.PI * (x * 7.1 + p3)) +
      0.12 * (rnd() - 0.5);
    v *= 0.45 + 0.55 * Math.pow(Math.sin(Math.PI * x), 0.5);
    out.push(Math.max(0.08, Math.min(1, v)));
  }
  return out;
}

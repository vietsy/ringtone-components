"use client";

import type * as React from "react";
import { PlayerAmbient } from "./PlayerAmbient";
import { PlayerRail } from "./PlayerRail";
import { cx, lang } from "./lib/helpers";
import { RETIRED_TONES, toneOf } from "./lib/player-parts";
import type { Locale, RailProps, Tone } from "./lib/types";

// Track tones. Named apart from the Table's row TONES above: both are var in one scope, and the later one won.
// Since 1 Oct 2026 the two tones come from the RightOne logo: teal and blue. A title keeps the place it had: the
// titles that drew lime now draw teal, the ones that drew stone draw blue. The retired names (lime, stone, sky)
// still work as a tone prop and map to the brand tone that replaced them.
const TRACK_TONES = ["teal", "blue"];

export type PlayerFrameProps = {
  size?: "sm" | "md" | "lg" | undefined;
  orient?: "landscape" | "portrait" | undefined;
  rail?: RailProps | undefined;
  track?: string | undefined;
  tone?: "auto" | "none" | Tone | "lime" | "stone" | "sky" | undefined;
  ambient?: boolean | undefined;
  art?: string | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function PlayerFrame(p: PlayerFrameProps) {
  const size = p.size === "lg" || p.size === "sm" ? p.size : "md";
  const upright = size !== "lg" && p.orient === "portrait";
  // A retired tone name maps to its brand tone; anything else falls back to the track's own tone.
  const asked = (RETIRED_TONES as Partial<Record<string, string>>)[String(p.tone)] || p.tone;
  const tone =
    p.tone === "none" || !p.track
      ? null
      : (TRACK_TONES as readonly (string | undefined)[]).indexOf(asked) >= 0
        ? asked
        : toneOf(p.track);
  // Glass comes with the tone: only while a track plays. ambient={false} keeps the flat tone ground.
  const ambient = !!tone && p.ambient !== false;
  return (
    <div
      className={cx(
        "r1-pframe",
        "r1-pframe--" + size,
        upright ? "r1-pframe--portrait" : "r1-pframe--landscape",
        tone && "r1-toned r1-tone--" + tone,
        ambient && "r1-pframe--ambient",
        p.className,
      )}
      data-theme="player"
      lang={lang(p.locale)}
      style={p.style}
    >
      {ambient ? <PlayerAmbient title={p.track} src={p.art} /> : null}
      <PlayerRail locale={p.locale} {...(p.rail || {})} {...{ size: size }} />
      <main className="r1-pframe__main">{p.children}</main>
    </div>
  );
}

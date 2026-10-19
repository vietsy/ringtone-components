"use client";

import type * as React from "react";
import { Artwork } from "./Artwork";
import { cx } from "./lib/helpers";

export type PlayerAmbientProps = {
  title?: string | undefined;
  src?: string | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The Player frame. size "sm" is a phone, "md" a tablet, "lg" the 1920 x 1080 staff screen; orient turns sm and md
// upright. On its side the rail runs down the left; upright it becomes a band across the top. Every Player part
// scales with the frame, so a screen is written once and shown at every size. The frame's width and height, and
// the sizes its parts share (--pl-*), come from tokens in bundle.css, one set per size.
// The ground of a playing Player: the track's own cover, enlarged far past the frame and out of focus, under a veil of
// the ground colour, so the glass panels above it have something to show. Drawn once and never animated: the Player
// runs on old hardware, so the blur is paid for one time and the panels are see-through fills, not live backdrop
// filters. A catalogue image (src) is used when there is one; until then the groove stand-in for the title.
export function PlayerAmbient(p: PlayerAmbientProps) {
  return (
    <div className={cx("r1-ambient", p.className)} style={p.style} aria-hidden="true">
      <div className="r1-ambient__art">
        {p.src ? (
          <img className="r1-ambient__img" src={p.src} alt="" />
        ) : (
          <Artwork variant="groove" title={p.title} size={320} style={{ width: "100%", height: "100%" }} />
        )}
      </div>
    </div>
  );
}

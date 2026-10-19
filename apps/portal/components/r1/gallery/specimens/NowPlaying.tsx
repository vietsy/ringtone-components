"use client";

import { Artwork, NowPlaying } from "../..";
import type { Specimen } from "../specimen";

export const NowPlayingSpecimen: Specimen = {
  name: "NowPlaying",
  group: "Player",
  height: 1060,
  render() {
    const title = "Để anh nói nốt";
    // Figma's Scale=Compact, playing and paused: 358 px, the width of the phone frame's centre column.
    const compact = function (paused: boolean) {
      return (
        <div style={{ width: "calc(var(--player-width-phone) - 2 * var(--space-4))" }}>
          <NowPlaying
            scale="compact"
            paused={paused}
            title={title}
            byline="Vy Sa ft. Duy Khê"
            credits={{
              composer: "Võ Duy Khê",
              lyricist: "Võ Duy Khê, Vy Sa",
              performer: "Vy Sa, Duy Khê",
              producer: "Lầu 3 Studio",
            }}
            locale="vi"
          >
            <Artwork variant="groove" title={title} size={160} tone="teal" state={paused ? "paused" : "shown"} locale="vi" />
          </NowPlaying>
        </div>
      );
    };
    return (
      <div style={{ display: "grid", gap: "var(--space-4)", padding: "var(--space-4)" }}>
        <div
          data-theme="player"
          style={{
            background: "var(--page)",
            color: "var(--on-surface)",
            padding: "var(--space-4)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-8)",
            alignItems: "flex-start",
          }}
        >
          {compact(false)}
          {compact(true)}
        </div>
        <NowPlaying
          scale="phone"
          title="Để anh nói nốt"
          byline="Vy Sa ft. Duy Khê"
          credits={{
            composer: "Võ Duy Khê",
            lyricist: "Võ Duy Khê, Vy Sa",
            performer: "Vy Sa, Duy Khê",
            producer: "Lầu 3 Studio",
          }}
          optional={[
            { label: "Lời bài hát", state: "available" },
            { label: "Ủng hộ nghệ sĩ", state: "unavailable" },
          ]}
          locale="vi"
        />
        <div style={{ zoom: 0.4, width: "var(--player-width-lg)" }}>
          <NowPlaying
            scale="display"
            title="Chủ nhật lười"
            credits={{
              composer: "Âu Thiện Khang",
              lyricist: undefined,
              performer: "Xe Đạp Điện",
              producer: "Nhà Hát Nhỏ Records",
            }}
            locale="vi"
          />
        </div>
      </div>
    );
  },
};

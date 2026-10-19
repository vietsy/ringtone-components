"use client";

import { WaveBar } from "../..";
import type { Specimen } from "../specimen";

export const WaveBarSpecimen: Specimen = {
  name: "WaveBar",
  group: "Player",
  height: 248,
  render() {
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          color: "var(--on-surface)",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-8)",
          maxWidth: "calc(var(--spacing) * 152)",
        }}
      >
        <WaveBar elapsed={84} duration={276} title="Để anh nói nốt" locale="vi" />
        <WaveBar elapsed={144} duration={276} paused={true} title="Để anh nói nốt" locale="vi" />
      </div>
    );
  },
};

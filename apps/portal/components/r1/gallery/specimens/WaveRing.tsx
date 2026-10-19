"use client";

import { WaveRing } from "../..";
import type { Specimen } from "../specimen";

export const WaveRingSpecimen: Specimen = {
  name: "WaveRing",
  group: "Player",
  height: 300,
  render() {
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          color: "var(--on-surface)",
          padding: "var(--space-6)",
          display: "flex",
          gap: "var(--space-8)",
          alignItems: "center",
        }}
      >
        <WaveRing elapsed={84} duration={276} size={236} title="Để anh nói nốt" locale="vi" />
        <WaveRing elapsed={130} duration={276} size={236} paused={true} title="Để anh nói nốt" locale="vi" />
        <WaveRing elapsed={84} duration={276} size={144} title="Để anh nói nốt" locale="vi" />
      </div>
    );
  },
};

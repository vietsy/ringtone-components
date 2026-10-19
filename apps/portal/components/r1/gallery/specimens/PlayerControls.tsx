"use client";

import { PlayerControls } from "../..";
import type { Specimen } from "../specimen";

export const PlayerControlsSpecimen: Specimen = {
  name: "PlayerControls",
  group: "Player",
  height: 488,
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
          maxWidth: "var(--container-xl)",
        }}
      >
        <PlayerControls transport={true} progress={false} elapsed={84} duration={276} volume={60} locale="vi" />
        <PlayerControls elapsed={130} duration={276} volume={60} paused={true} title="Để anh nói nốt" locale="vi" />
      </div>
    );
  },
};

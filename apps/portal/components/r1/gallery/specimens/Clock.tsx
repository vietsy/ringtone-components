"use client";

import { Clock } from "../..";
import type { Specimen } from "../specimen";

export const ClockSpecimen: Specimen = {
  name: "Clock",
  group: "Player",
  height: 120,
  render() {
    const d = new Date("2026-09-28T12:28:00+07:00");
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          color: "var(--on-surface)",
          padding: "var(--space-6)",
          display: "flex",
          gap: "var(--space-12)",
        }}
      >
        <Clock time={d} locale="vi" />
        <Clock time={d} locale="en" />
      </div>
    );
  },
};

"use client";

import { PlayerFacts } from "../..";
import type { Specimen } from "../specimen";

export const PlayerFactsSpecimen: Specimen = {
  name: "PlayerFacts",
  group: "Player",
  height: 368,
  render() {
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          color: "var(--on-surface)",
          padding: "var(--space-6)",
          width: "calc(var(--spacing) * 68)",
        }}
      >
        <PlayerFacts
          title="Cho bộ phận hỗ trợ"
          locale="vi"
          items={[
            { label: "Mã tham chiếu", value: "5c1e 08ad", code: true },
            { label: "Minh chứng chờ gửi", value: 786 },
            { label: "Kết nối lần cuối", value: new Date("2026-09-26T06:48:00+07:00") },
          ]}
        />
      </div>
    );
  },
};

"use client";

import { PlayerRail } from "../..";
import type { Specimen } from "../specimen";

export const PlayerRailSpecimen: Specimen = {
  name: "PlayerRail",
  group: "Player",
  height: 800,
  render() {
    const at = function (s: string) {
      return new Date(s + "+07:00");
    };
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          color: "var(--on-surface)",
          display: "flex",
          gap: "var(--space-6)",
          height: "var(--player-height)",
        }}
      >
        <PlayerRail
          premises="Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng"
          place="Phường Sài Gòn, TP. Hồ Chí Minh"
          condition="offline"
          detail={[
            { text: "Từ {at}", at: at("2026-09-26T06:48:00") },
            { text: "{n} minh chứng chờ gửi", n: 614 },
          ]}
          meter={{ value: 18.2, max: 72, note: "Hết giờ thì nhạc dừng." }}
          device="PLY-0031"
          facts={[{ text: "{n} / {total} bài sẵn sàng", n: 402, total: 402 }]}
          href="#"
          locale="vi"
          style={{ width: "var(--space-64)" }}
        />
        <PlayerRail
          premises={"Then Cửa Coffee & Tea – Pasteur"}
          place="Phường Bến Thành, TP. Hồ Chí Minh"
          condition="cannot-continue"
          detail={["Không có lịch nào áp dụng lúc này"]}
          device="PLY-0023"
          facts={[{ text: "{n} / {total} bài sẵn sàng", n: 286, total: 286 }]}
          href="#"
          locale="vi"
          style={{ width: "var(--space-64)" }}
        />
      </div>
    );
  },
};

"use client";

import { UpNext } from "../..";
import type { Specimen } from "../specimen";

export const UpNextSpecimen: Specimen = {
  name: "UpNext",
  group: "Player",
  height: 680,
  render() {
    const at = function (hm: string) {
      return new Date("2026-09-28T" + hm + ":00+07:00");
    };
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          color: "var(--on-surface)",
          padding: "var(--space-6)",
          display: "flex",
          gap: "var(--space-10)",
          alignItems: "flex-start",
        }}
      >
        <UpNext
          schedule="Lịch “Giờ trưa”"
          start={at("11:00")}
          end={at("14:00")}
          left={92 * 60000}
          moreCount={18}
          moreUntil={at("14:00")}
          locale="vi"
          style={{ width: "calc(var(--spacing) * 68)" }}
          next={[
            { time: at("12:31"), title: "Bossa cho buổi trưa", performer: "Hạt Tiêu Trio" },
            { time: at("12:35"), title: "Về đi, trời mưa rồi", performer: "Na Bích" },
            { time: at("12:39"), title: "Chủ nhật lười", performer: "Xe Đạp Điện" },
          ]}
          later={[
            { time: at("12:43"), title: "Đầu ca thứ Hai (Lofi ver.)" },
            { time: at("12:47"), title: "Khẽ thôi, phố ngủ rồi" },
            { time: at("12:51"), title: "Lobby Lights at Half Past Nine" },
          ]}
        />
        <UpNext
          schedule="Lịch “Đóng cửa”"
          start={at("21:30")}
          end={at("22:00")}
          left={4 * 60000}
          locale="vi"
          style={{ width: "calc(var(--spacing) * 68)" }}
        />
      </div>
    );
  },
};

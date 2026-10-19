"use client";

import { DeviceBar } from "../..";
import type { Specimen } from "../specimen";

export const DeviceBarSpecimen: Specimen = {
  name: "DeviceBar",
  group: "Player",
  height: 272,
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
          gap: "var(--space-6)",
        }}
      >
        <DeviceBar
          premises={"Then Cửa Coffee & Tea – Pasteur"}
          device="PLY-0023"
          family="positive"
          state="Đang phát"
          detail="Đồng bộ lúc 12:24, 0 minh chứng chờ gửi"
          time={new Date("2026-09-28T12:28:00+07:00")}
          locale="vi"
        />
        <DeviceBar
          premises={"Then Cửa Coffee & Tea – Pasteur"}
          device="PLY-0023"
          family="danger"
          state="Đã dừng"
          detail="Hết thời gian phát khi mất kết nối"
          time={new Date("2026-09-29T06:52:00+07:00")}
          locale="vi"
        />
      </div>
    );
  },
};

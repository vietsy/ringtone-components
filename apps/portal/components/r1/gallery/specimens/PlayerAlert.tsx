"use client";

import { Button, PlayerAlert } from "../..";
import type { Specimen } from "../specimen";

export const PlayerAlertSpecimen: Specimen = {
  name: "PlayerAlert",
  group: "Player",
  height: 448,
  render() {
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          color: "var(--on-surface)",
          padding: "var(--space-6)",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "var(--space-8)",
        }}
      >
        <PlayerAlert
          condition="limit-reached"
          when={new Date("2026-09-29T06:48:00+07:00")}
          title="Nhạc đã dừng"
          why="Giấy phép trên thiết bị cho phát 72 giờ khi không có kết nối. Thời hạn đó đã hết lúc 06:48."
          action="Kết nối lại internet cho thiết bị. Nhạc tự phát lại khi có kết nối."
          locale="vi"
        >
          <Button variant="primary" size="xl" icon="refresh-cw" locale="vi">
            Thử kết nối lại
          </Button>
        </PlayerAlert>
        <PlayerAlert
          condition="fault"
          when="14:07"
          title="Player không đọc được nhạc trên máy"
          why="Bộ nhớ chứa nhạc không phản hồi."
          action="Khởi động lại Player. Nếu vẫn vậy, gọi bộ phận hỗ trợ."
          locale="vi"
        >
          <Button variant="primary" size="xl" icon="power" locale="vi">
            Khởi động lại Player
          </Button>
        </PlayerAlert>
      </div>
    );
  },
};

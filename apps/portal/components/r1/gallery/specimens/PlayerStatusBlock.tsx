"use client";

import { PlayerStatusBlock } from "../..";
import type { Specimen } from "../specimen";

export const PlayerStatusBlockSpecimen: Specimen = {
  name: "PlayerStatusBlock",
  group: "Player",
  height: 640,
  render() {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "var(--space-4)",
          padding: "var(--space-4)",
          background: "var(--page)",
        }}
      >
        <PlayerStatusBlock condition="online" subject={"Then Cửa Coffee & Tea – Pasteur, PLY-0023"} locale="vi">
          <p>Đang phát theo lịch “Buổi sáng”.</p>
        </PlayerStatusBlock>
        <PlayerStatusBlock
          condition="offline"
          subject="Khách sạn Mây Sông, PLY-0031"
          remaining={{ value: 18.2, total: 72 }}
          facts={[
            { label: "Minh chứng chờ gửi", value: 614 },
            { label: "Kết nối lần cuối", value: new Date("2026-09-26T06:48:00+07:00") },
          ]}
          locale="vi"
        >
          <p>Đang phát từ nhạc đã có sẵn trên thiết bị.</p>
        </PlayerStatusBlock>
        <PlayerStatusBlock
          condition="limit-reached"
          subject="Khách sạn Mây Sông, PLY-0031"
          action={{ label: "Kiểm tra kết nối", icon: "wifi", href: "#" }}
          locale="vi"
        >
          <p>Giấy phép trên thiết bị cho phát tối đa 72 giờ khi không có kết nối, và thời hạn đó đã hết.</p>
        </PlayerStatusBlock>
        <PlayerStatusBlock
          condition="cannot-continue"
          subject="Áp Mái Bar – Thảo Điền, PLY-0017"
          action={{ label: "Đặt danh sách mặc định", icon: "list-music", href: "#" }}
          locale="vi"
        >
          <p>Chưa đặt danh sách mặc định, nên ngoài giờ có lịch thì không có gì để phát.</p>
        </PlayerStatusBlock>
      </div>
    );
  },
};

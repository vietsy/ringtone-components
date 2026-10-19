"use client";

import { QrCode } from "../..";
import type { Specimen } from "../specimen";

export const QrCodeSpecimen: Specimen = {
  name: "QrCode",
  group: "Player",
  height: 240,
  render() {
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          padding: "var(--space-6)",
          display: "flex",
          gap: "var(--space-6)",
          alignItems: "center",
          color: "var(--on-surface-secondary)",
        }}
      >
        <QrCode
          value="https://rightone.vn/v/player/RPS-7K2MQXB4TD"
          size={184}
          label="Mã QR mở trang kiểm tra quyền sử dụng dịch vụ của cơ sở này"
        />
        <p style={{ margin: 0, fontSize: "var(--text-xl)", lineHeight: "var(--leading-xl)" }}>
          Quét mã để kiểm tra quyền sử dụng dịch vụ của cơ sở.
        </p>
      </div>
    );
  },
};

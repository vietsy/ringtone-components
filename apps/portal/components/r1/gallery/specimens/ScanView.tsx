"use client";

import { ScanView } from "../..";
import type { Specimen } from "../specimen";

export const ScanViewSpecimen: Specimen = {
  name: "ScanView",
  group: "Operations",
  height: 980,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, var(--container-3xs)), 1fr))",
          alignItems: "start",
        }}
      >
        <ScanView state="asking" recordNoun="giấy xác nhận" />
        <ScanView state="scanning" recordNoun="giấy xác nhận" />
        <ScanView state="found" code="R1-CER-2026-T7QM4BWJ" recordNoun="giấy xác nhận" />
        <ScanView state="denied" />
        <ScanView
          state="unavailable"
          recordNoun="giấy xác nhận"
          reason="Khoá xác minh trên máy đã hết hạn nên chưa đọc được mã. Nhập mã in bên cạnh mã QR, hoặc kết nối mạng để tải khoá mới."
        />
        <ScanView
          state="scanning"
          labels={{ scanning: "Đưa mã QR trên tờ giấy treo tại quầy vào giữa khung.", manual: "Nhập mã bằng tay" }}
        />
      </div>
    );
  },
};

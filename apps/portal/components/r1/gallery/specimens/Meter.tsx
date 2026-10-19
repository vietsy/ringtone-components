"use client";

import { Meter, format } from "../..";
import type { Specimen } from "../specimen";

export const MeterSpecimen: Specimen = {
  name: "Meter",
  group: "Data",
  height: 340,
  render() {
    return (
      <div
        className="pv"
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: "var(--space-8)" }}
      >
        <div
          data-theme="player"
          style={{ background: "var(--page)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)" }}
        >
          <Meter
            variant="ring"
            value={18.2}
            max={72}
            size={220}
            family="info"
            centerLabel="18 giờ 12 phút"
            centerSub="còn lại trên 72 giờ"
            label="Thời gian phát khi mất kết nối"
            locale="vi"
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", width: "var(--space-80)" }}>
          <Meter
            value={318}
            max={402}
            caption="Đã chép 318 trên 402 bài"
            family="info"
            label="Chép kho nhạc"
            locale="vi"
          />
          <Meter
            value={29.4}
            max={32}
            caption="Đã dùng 29,4 trên 32 GB"
            family="attention"
            label="Bộ nhớ đã dùng"
            locale="vi"
          />
          <Meter
            value={null}
            max={32}
            caption="Chưa đọc được bộ nhớ của thiết bị"
            family="attention"
            label="Bộ nhớ đã dùng"
            locale="vi"
          />
          <Meter
            value={946766800}
            max={1104380000}
            caption={
              "Chuyển cho các tổ chức nhận " +
              format.money(946766800) +
              ", bằng " +
              format.percent(85.73, "vi", { decimals: 2 }) +
              " số đã thu."
            }
            family="info"
            label="Phần còn lại so với mức sàn"
            marker={{ value: 938723000, label: "Mức sàn " + format.percent(85) }}
            locale="vi"
          />
        </div>
      </div>
    );
  },
};

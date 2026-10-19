"use client";

import { Chart } from "../..";
import type { Specimen } from "../specimen";

export const ChartSpecimen: Specimen = {
  name: "Chart",
  group: "Data",
  height: 680,
  render() {
    return (
      <div className="pv">
        <Chart
          title="Minh chứng được chấp nhận theo tuần"
          summary="Bốn tuần của tháng 6, 2026, theo ba nhóm cơ sở"
          categories={["T1", "T2", "T3", "T4"]}
          series={[
            { name: "Quán cà phê", values: [312, 340, 298, 355] },
            { name: "Nhà hàng", values: [210, 190, 230, 244] },
            { name: "Khách sạn", values: [120, 130, 90, 140] },
          ]}
          freshness={{ period: { from: "2026-06-01", to: "2026-06-30" }, asOf: "2026-07-01T02:00:00+07:00" }}
        />
        <div
          data-theme="player"
          style={{
            padding: "var(--space-6)",
            background: "var(--surface)",
            color: "var(--on-surface)",
            borderRadius: "var(--radius-xl)",
          }}
        >
          <Chart
            title="Bài đã phát theo giờ, hôm nay"
            summary="Bốn khung giờ, ba danh sách phát"
            categories={["08:00", "12:00", "16:00", "20:00"]}
            series={[
              { name: "Sáng mở cửa", values: [14, 9, null, 0] },
              { name: "Trưa văn phòng", values: [0, 16, 11, 0] },
              { name: "Chill tối", values: [0, 0, 6, 17] },
            ]}
          />
        </div>
      </div>
    );
  },
};

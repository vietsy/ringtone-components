"use client";

import { MetricValue, format } from "../..";
import type { Specimen } from "../specimen";

export const MetricValueSpecimen: Specimen = {
  name: "MetricValue",
  group: "Values",
  height: 252,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          alignItems: "start",
          gap: "var(--space-6)",
        }}
      >
        <MetricValue label="Minh chứng được chấp nhận" value={12408} note="Tháng 9, 2026" />
        <MetricValue
          label="Tỉ lệ chấp nhận"
          value={96.4}
          kind="percent"
          state="derived"
          basis={format.count(12408) + " trên " + format.count(12871) + " minh chứng"}
          interval={[95.1, 97.6]}
        />
        <MetricValue label="Tỉ lệ đối soát" value={88.2} kind="percent" state="derived" />
        <MetricValue
          label="Minh chứng đang tạm giữ"
          value={0}
          state="zero"
          note="Không có minh chứng nào bị tạm giữ trong tháng 9, 2026."
        />
        <MetricValue
          label="Tiền phân phối kỳ tháng 9"
          state="no-data"
          note={"Kỳ tháng 9, 2026 chưa khoá sổ; số liệu có từ " + format.date("2026-10-05") + "."}
        />
        <MetricValue
          label="Tỉ lệ chi phí luỹ kế"
          value={14}
          kind="percent"
          decimals={2}
          state="derived"
          basis={"chi phí và số đã thu từ " + format.date("2026-07-01")}
        />
      </div>
    );
  },
};

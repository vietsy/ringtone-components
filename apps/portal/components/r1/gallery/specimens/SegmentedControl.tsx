"use client";

import { SegmentedControl } from "../..";
import type { Specimen } from "../specimen";

export const SegmentedControlSpecimen: Specimen = {
  name: "SegmentedControl",
  group: "Forms",
  height: 200,
  render() {
    return (
      <div
        className="pv"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "flex-start" }}
      >
        <SegmentedControl
          label="Loại"
          value="all"
          options={[
            { value: "all", label: "Tất cả", count: 14 },
            { value: "g", label: "Cổng", count: 3 },
            { value: "p", label: "Chính sách", count: 8 },
            {
              value: "r",
              label: "Rủi ro",
              count: 0,
              disabled: true,
              reason: "Kỳ này chưa có rủi ro nào được ghi nhận.",
            },
          ]}
        />
        <SegmentedControl
          label="Từng khung giờ"
          density="portal"
          value="d4"
          options={["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(function (d, i) {
            return { value: "d" + i, label: d };
          })}
        />
      </div>
    );
  },
};

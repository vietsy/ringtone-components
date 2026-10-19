"use client";

import { Comparison } from "../..";
import type { Specimen } from "../specimen";

export const ComparisonSpecimen: Specimen = {
  name: "Comparison",
  group: "Data",
  height: 352,
  render() {
    return (
      <div className="pv">
        <Comparison
          caption="Biểu phí quán cà phê, phiên bản 1 và 2"
          columns={[
            { key: "v1", label: "Phiên bản 1", meta: "Đang áp dụng" },
            { key: "v2", label: "Phiên bản 2", meta: "Bản nháp" },
          ]}
          rows={[
            {
              key: "a",
              label: "Quán cà phê, 60–120 m², mỗi tháng",
              kind: "money",
              values: { v1: 231000, v2: 243000 },
              changed: true,
            },
            {
              key: "b",
              label: "Phụ thu sau 22:00",
              kind: "percent",
              decimals: 2,
              values: { v1: 10, v2: 12.5 },
              changed: true,
            },
            { key: "c", label: "Giảm khi đăng ký sớm", kind: "percent", values: { v1: 5, v2: 5 } },
            {
              key: "d",
              label: "Hiệu lực từ",
              kind: "date",
              values: { v1: "2026-01-01", v2: "2027-01-01" },
              changed: true,
            },
            {
              key: "e",
              label: "Người duyệt",
              values: { v1: "Nguyễn Hạnh Dung", v2: null },
              missing: "Chưa duyệt",
              changed: true,
            },
          ]}
        />
      </div>
    );
  },
};

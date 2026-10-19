"use client";

import { Breakdown, format } from "../..";
import type { Specimen } from "../specimen";

export const BreakdownSpecimen: Specimen = {
  name: "Breakdown",
  group: "Values",
  height: 528,
  render() {
    return (
      <div className="pv" style={{ maxWidth: "var(--container-2xl)" }}>
        <Breakdown
          title="Phí bản quyền năm 2027"
          indicative={true}
          description={"Then Cửa Coffee & Tea – Pasteur, quán cà phê 96 m²."}
          lines={[
            {
              label: "Biểu phí quán cà phê, 60–120 m²",
              source: "Biểu phí 2027, phiên bản 1",
              basis: "12 tháng × " + format.money(243000),
              amountMinor: 2916000,
            },
            {
              label: "Phát nhạc sau 22:00",
              detail: "Lịch Chill tối kết thúc lúc 23:00 (GMT+7) từ thứ Sáu đến Chủ nhật.",
              basis: "10\u00a0%",
              amountMinor: 291600,
            },
            {
              label: "Giảm cho cơ sở đăng ký trước " + format.date("2026-12-31"),
              kind: "subtract",
              basis: "5\u00a0%",
              amountMinor: 160380,
            },
            { label: "Cộng", kind: "subtotal", amountMinor: 3047220 },
            { label: "Thuế giá trị gia tăng", basis: "8\u00a0%", amountMinor: 243778 },
            { label: "Số tiền tham khảo", kind: "total", amountMinor: 3290998 },
          ]}
          note="Số tiền chính thức được xác nhận khi hồ sơ được duyệt. Có thể trả một lần hoặc theo quý."
        />
      </div>
    );
  },
};

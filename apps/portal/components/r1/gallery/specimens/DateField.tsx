"use client";

import { DateField } from "../..";
import type { Specimen } from "../specimen";

export const DateFieldSpecimen: Specimen = {
  name: "DateField",
  group: "Forms",
  height: 560,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          alignItems: "start",
          minHeight: "var(--space-96)",
        }}
      >
        <DateField
          label="Có hiệu lực từ"
          helper="Gõ theo dạng ngày/tháng/năm hoặc chọn trên lịch."
          required={true}
          value="2026-10-03"
          open={true}
          today="2026-09-29"
          min="2026-09-29"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <DateField label="Kỳ báo cáo" range={true} value="2026-09-01" to="2026-09-30" required={true} />
          <DateField label="Kỳ đã khoá sổ" range={true} readOnly={true} value="2026-08-01" to="2026-08-31" />
          <DateField
            label="Thời hạn uỷ quyền"
            range={true}
            value="2026-11-01"
            toPlaceholder="Không thời hạn"
            helper="Để trống ngày kết thúc nếu uỷ quyền không thời hạn."
          />
          <DateField label="Hiệu lực lúc" withTime={true} required={true} value="2026-10-03" time="18:30" step={15} />
        </div>
      </div>
    );
  },
};

"use client";

import { TracePath } from "../..";
import type { Specimen } from "../specimen";

export const TracePathSpecimen: Specimen = {
  name: "TracePath",
  group: "Data",
  height: 320,
  render() {
    return (
      <div className="pv" style={{ gap: "var(--space-8)" }}>
        <TracePath
          label="Cách tính phí"
          steps={[
            { label: "Diện tích khai báo", value: 96, kind: "count", unit: "m²" },
            { label: "Nhóm cơ sở", value: "Quán cà phê" },
            { label: "Bậc", value: "60–120 m²" },
            { label: "Quy tắc", value: "Biểu phí 2027, phiên bản 1", href: "#" },
            { label: "Số tiền mỗi tháng", value: 243000, kind: "money" },
            { label: "Áp dụng từ", value: "2027-01-01", kind: "date" },
          ]}
        />
        <TracePath
          label="Sáu liên kết của khoản tiền"
          steps={[
            { label: "Quyết định nghĩa vụ", value: null, missing: "Thiếu: không tìm thấy", state: "gap" },
            { label: "Người trả", value: null, missing: "Thiếu: chưa xác định", state: "gap" },
            { label: "Phân bổ", value: null, missing: "Chưa có: khoản tiền còn đang giữ", state: "pending" },
            { label: "Hoá đơn", value: null, missing: "Chưa có: khoản tiền còn đang giữ", state: "pending" },
            {
              label: "Quyết toán",
              value: "2026-09-19T09:12:00+07:00",
              kind: "datetime",
              detail: "Nội dung PHI AM NHAC THANG 9",
            },
            { label: "Điều chỉnh sau đó", value: "COR-7MXK2PVT9D", kind: "id", href: "#", detail: "Đòi lại qua thẻ" },
          ]}
        />
      </div>
    );
  },
};

"use client";

import { PrintableRecord } from "../..";
import type { Specimen } from "../specimen";

export const PrintableRecordSpecimen: Specimen = {
  name: "PrintableRecord",
  group: "Legal",
  height: 1190,
  render() {
    return (
      <div style={{ padding: "var(--space-4)", background: "var(--page)" }}>
        <PrintableRecord
          title="Giấy xác nhận của cơ sở"
          subtitle="Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng"
          status={{ label: "Đã hoàn thành nghĩa vụ năm 2026" }}
          recordNoun="giấy xác nhận"
          recordId="R1-CER-2026-T7QM4BWJ"
          issuer="Cổng một cửa về quyền tác giả âm nhạc"
          issued="2026-09-29T10:15:00+07:00"
          facts={[
            { label: "Cơ sở", value: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng" },
            { label: "Địa chỉ", value: "12 Tôn Đức Thắng, phường Sài Gòn, TP. Hồ Chí Minh" },
            { label: "Phạm vi", value: "Phát nhạc nền tại sảnh và nhà hàng" },
            { label: "Hiệu lực", value: { from: "2026-01-01", to: "2026-12-31" }, kind: "period" },
          ]}
          verifyUrl="rightone.vn/v/R1-CER-2026-T7QM4BWJ"
        />
      </div>
    );
  },
};

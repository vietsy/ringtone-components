"use client";

import { LegalTextViewer } from "../..";
import type { Specimen } from "../specimen";

export const LegalTextViewerSpecimen: Specimen = {
  name: "LegalTextViewer",
  group: "Legal",
  height: 832,
  render() {
    const sections = [
      {
        id: "s1",
        heading: "1. Phạm vi",
        body: "Nghệ sĩ cấp cho dịch vụ quyền cho phép cơ sở đã đăng ký phát bản ghi này qua thiết bị được chấp thuận, trong thời hạn đã chọn.",
      },
      {
        id: "s2",
        heading: "2. Thời hạn",
        body: "Một, ba hoặc năm năm, hoặc không thời hạn. Mọi thời hạn đều có thể thu hồi, có hiệu lực sau 30 ngày.",
      },
      { id: "s3", heading: "3. Thu hồi", body: "Việc phát nhạc trước ngày thu hồi có hiệu lực vẫn hợp lệ." },
    ];
    return (
      <div className="pv">
        <LegalTextViewer
          title="Giấy phép trực tiếp"
          version="1.2"
          effective="2026-10-01"
          progress={38}
          height={150}
          sections={sections}
        />
        <div style={{ maxWidth: "var(--container-xs)" }}>
          <LegalTextViewer
            title="Giấy phép trực tiếp"
            version="1.2"
            effective="2026-10-01"
            height={150}
            sections={sections}
          />
        </div>
      </div>
    );
  },
};

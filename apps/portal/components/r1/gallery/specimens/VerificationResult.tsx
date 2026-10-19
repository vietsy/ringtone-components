"use client";

import { VerificationResult, format } from "../..";
import type { Specimen } from "../specimen";

export const VerificationResultSpecimen: Specimen = {
  name: "VerificationResult",
  group: "Legal",
  height: 900,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, var(--container-md)), 1fr))",
          alignItems: "start",
        }}
      >
        <VerificationResult
          result="valid"
          level={1}
          recordNoun="giấy xác nhận"
          recordId="R1-CER-2026-T7QM4BWJ"
          checkedAt="2026-09-29T10:15:00+07:00"
          facts={[
            { label: "Cơ sở", value: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng" },
            { label: "Hiệu lực đến", value: "2026-12-31", kind: "date" },
          ]}
        >
          <p>Cơ sở đã hoàn thành nghĩa vụ bản quyền âm nhạc cho năm 2026.</p>
        </VerificationResult>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <VerificationResult result="checking" recordNoun="giấy xác nhận" recordId="R1-CER-2026-T7QM4BWJ" />
          <VerificationResult
            result="revoked"
            recordNoun="giấy xác nhận"
            recordId="R1-CER-2026-B2XR6MJH"
            checkedAt="2026-09-29T10:15:00+07:00"
            checkedLabel="Tra cứu lúc"
          >
            <p>
              {"Giấy xác nhận bị thu hồi ngày " +
                format.date("2026-08-31") +
                " khi dịch vụ kết thúc theo yêu cầu của cơ sở."}
            </p>
          </VerificationResult>
          <VerificationResult result="not-found" recordId="R1-CER-2026-B2XR6MJ0" checkedAt="2026-09-29T10:15:00+07:00">
            <p>Kiểm tra lại mã in bên cạnh mã QR; mã gồm 8 ký tự sau R1-CER-2026-.</p>
          </VerificationResult>
        </div>
        <VerificationResult
          result="answer"
          family="danger"
          title="Dịch vụ của cơ sở này đang bị tạm đình chỉ"
          recordedAt="2026-10-05T09:12:00+07:00"
          recordedLabel="Lượt tra cứu này đã được ghi nhận. Hỏi lúc"
        >
          <p>Cơ sở chưa được phát nhạc bằng RightOne Player cho đến khi dịch vụ được mở lại.</p>
        </VerificationResult>
        <VerificationResult
          result="answer"
          family="attention"
          title="Giấy xác nhận này không còn là bản hiện hành"
          recordedAt="2026-10-05T09:12:00+07:00"
        >
          <p>Một bản mới hơn đã được cấp cho cùng cơ sở. Quét mã trên bản đang treo tại quầy.</p>
        </VerificationResult>
      </div>
    );
  },
};

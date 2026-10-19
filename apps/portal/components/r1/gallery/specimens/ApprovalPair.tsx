"use client";

import { ApprovalPair } from "../..";
import type { Specimen } from "../specimen";

export const ApprovalPairSpecimen: Specimen = {
  name: "ApprovalPair",
  group: "Legal",
  height: 664,
  render() {
    const prep = { name: "Nguyễn Hoàng Phương Uyên", role: "Chuyên viên minh chứng", at: "2026-09-27T16:20:00+07:00" };
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          alignItems: "start",
          gap: "var(--space-6)",
        }}
      >
        <ApprovalPair
          preparer={prep}
          approver={{ name: "Thạch Minh Khải", role: "Người duyệt minh chứng", at: "2026-09-28T09:05:00+07:00" }}
          decision="returned"
          comment="Ảnh hoá đơn bị mờ ở phần số tiền. Chụp lại rồi nộp lại."
        />
        <ApprovalPair preparer={prep} approver={null} awaiting="Chờ Thạch Minh Khải (người duyệt minh chứng) xem xét" />
        <ApprovalPair
          preparer={prep}
          approver={{
            name: "Nguyễn Hoàng Phương Uyên",
            role: "Chuyên viên minh chứng",
            at: "2026-09-27T16:22:00+07:00",
          }}
          sameActor={true}
        />
        <ApprovalPair
          preparer={prep}
          approver={{
            name: "Nguyễn Hoàng Phương Uyên",
            role: "Chuyên viên minh chứng",
            at: "2026-09-27T16:22:00+07:00",
          }}
          sameActor={{
            code: "SEG_SAME_ACTOR",
            family: "attention",
            title: "Bạn là người lập hồ sơ này nên không thể tự duyệt.",
            text: "Cần một người duyệt khác hoàn tất.",
          }}
        />
      </div>
    );
  },
};

"use client";

import { Banner, Dialog, format } from "../..";
import type { Specimen } from "../specimen";

export const DialogSpecimen: Specimen = {
  name: "Dialog",
  group: "Feedback",
  height: 330,
  render() {
    return (
      <div style={{ position: "relative", height: "var(--space-80)", background: "var(--page)" }}>
        <Dialog
          title="Chuyển thiết bị PLY-0031 sang cơ sở khác?"
          description="Quyền sử dụng dịch vụ của cơ sở mới áp dụng từ lúc chuyển."
          primaryAction={{
            label: "Chuyển thiết bị",
            ariaLabel: "Chuyển thiết bị PLY-0031",
            variant: "primary",
            disabled: true,
            disabledReason: "Chọn cách xử lý " + format.count(614) + " minh chứng chưa gửi trước.",
          }}
        >
          <Banner family="attention" compact={true} code="PENDING_EVIDENCE_UNDECIDED">
            Thiết bị này vẫn giữ minh chứng chưa đồng bộ. Hãy quyết định gửi chúng về cơ sở đang dùng thiết bị hay huỷ.
            Quyết định này được ghi dưới tên bạn.
          </Banner>
        </Dialog>
      </div>
    );
  },
};

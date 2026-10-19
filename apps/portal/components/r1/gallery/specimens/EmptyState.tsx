"use client";

import { EmptyState, format } from "../..";
import type { Specimen } from "../specimen";

export const EmptyStateSpecimen: Specimen = {
  name: "EmptyState",
  group: "Feedback",
  height: 900,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, var(--container-xs)), 1fr))",
          gap: "var(--space-3)",
          alignItems: "start",
        }}
      >
        <EmptyState variant="not-started">Minh chứng hiện ở đây trong vòng 24 giờ sau khi phát.</EmptyState>
        <EmptyState
          variant="governed"
          title={"Không có minh chứng nào đủ điều kiện trong kỳ " + format.period("2026-09-01", "2026-09-30") + "."}
        >
          Đã nhận 12 lượt gửi, tất cả đều ngoài khung thời gian chấp nhận.
        </EmptyState>
        <EmptyState
          variant="governed"
          title="Chưa có giấy xác nhận nào được cấp trong đợt này."
          decision="Phê duyệt biểu phí khách sạn năm 2027"
          decider="Hội đồng biểu phí"
          due="2026-10-15T17:00:00+07:00"
        >
          Giấy xác nhận được cấp sau khi biểu phí áp dụng cho các cơ sở trong đợt được phê duyệt.
        </EmptyState>
        <EmptyState
          variant="filtered"
          title="Không có quyền sử dụng nào ở trạng thái này."
          onClearFilters={function () {}}
        />
        <EmptyState variant="no-obligation">
          Giấy xác nhận này in được và kiểm tra được như mọi giấy xác nhận khác.
        </EmptyState>
        <EmptyState variant="error" traceId="0af76519c2e8431b" retryable={true}>
          Dịch vụ minh chứng không trả lời.
        </EmptyState>
      </div>
    );
  },
};

"use client";

import { DeadlineClock } from "../..";
import type { Specimen } from "../specimen";

export const DeadlineClockSpecimen: Specimen = {
  name: "DeadlineClock",
  group: "Operations",
  height: 360,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, var(--space-60)), 1fr))",
          alignItems: "start",
          gap: "var(--space-6)",
        }}
      >
        <DeadlineClock
          label="Hạn trả lời cơ sở"
          start="2026-09-25T09:00:00+07:00"
          due="2026-10-02T17:00:00+07:00"
          now="2026-09-29T10:15:00+07:00"
        />
        <DeadlineClock
          label="Hạn xử lý khiếu nại"
          start="2026-09-22T16:00:00+07:00"
          due="2026-09-29T16:00:00+07:00"
          now="2026-09-29T10:15:00+07:00"
          announceAt={[30, 5]}
        />
        <DeadlineClock
          label="Hạn quyết định tạm giữ"
          start="2026-09-20T17:00:00+07:00"
          due="2026-09-27T17:00:00+07:00"
          now="2026-09-29T10:15:00+07:00"
        />
        <DeadlineClock
          label="Hạn duyệt đơn đăng ký"
          due="2026-09-28T17:00:00+07:00"
          metAt="2026-09-26T09:40:00+07:00"
          now="2026-09-29T10:15:00+07:00"
        />
        <DeadlineClock
          label="Hạn duyệt đơn đăng ký"
          due="2026-10-06T17:00:00+07:00"
          paused={true}
          pausedReason="Chờ cơ sở bổ sung giấy phép kinh doanh."
          now="2026-09-29T10:15:00+07:00"
        />
        <DeadlineClock label="Hạn bổ sung chứng từ" now="2026-09-29T10:15:00+07:00" />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <DeadlineClock size="sm" due="2026-09-29T16:00:00+07:00" now="2026-09-29T10:15:00+07:00" />
          <DeadlineClock size="sm" due="2026-09-27T17:00:00+07:00" now="2026-09-29T10:15:00+07:00" />
        </div>
      </div>
    );
  },
};

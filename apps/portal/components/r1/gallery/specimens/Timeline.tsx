"use client";

import { Timeline, format } from "../..";
import type { Specimen } from "../specimen";

export const TimelineSpecimen: Specimen = {
  name: "Timeline",
  group: "Operations",
  height: 300,
  render() {
    return (
      <div className="pv" style={{ display: "block" }}>
        <Timeline
          entries={[
            {
              id: "c3",
              title: "Báo mất",
              status: { family: "danger", label: "Đã báo mất" },
              at: "2026-09-10T14:00:00+07:00",
              actor: "Trần Thị Mỹ Hạnh, chủ cơ sở",
              detail:
                "Ghi nhận lúc " +
                format.timestamp("2026-09-12T09:20:00+07:00") +
                ". Minh chứng từ " +
                format.timestamp("2026-09-10T14:00:00+07:00") +
                " bị tạm giữ.",
              current: true,
            },
            {
              id: "c4",
              kind: "correction",
              corrects: "c2",
              title: "Đính chính thời điểm kích hoạt",
              at: "2026-02-03T10:12:00+07:00",
              actor: "Lê Đăng Quý, vận hành",
            },
            {
              id: "c2",
              title: "Đang hoạt động",
              status: { family: "positive", label: "Đang hoạt động" },
              at: "2026-02-01T09:00:00+07:00",
              actor: "Hệ thống",
            },
          ]}
        />
      </div>
    );
  },
};

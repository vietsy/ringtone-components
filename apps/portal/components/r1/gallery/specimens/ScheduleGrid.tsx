"use client";

import { ScheduleGrid, format } from "../..";
import type { Specimen } from "../specimen";

export const ScheduleGridSpecimen: Specimen = {
  name: "ScheduleGrid",
  group: "Data",
  height: 280,
  render() {
    return (
      <div className="pv">
        <ScheduleGrid
          caption={"Nội dung phát, " + format.period("2026-10-02", "2026-10-04")}
          kinds={{
            scheduled: "theo lịch",
            default: "mặc định: Sáng mở cửa",
            fallback: "lịch không phát được, chuyển sang mặc định",
            none: "không có gì để phát",
          }}
          days={[
            {
              label: "Thứ Sáu, 2 thg 10",
              segments: [
                { from: "00:00", to: "11:00", kind: "default", label: "mặc định" },
                { from: "11:00", to: "13:30", kind: "scheduled", label: "Trưa văn phòng" },
                { from: "13:30", to: "18:00", kind: "default", label: "mặc định" },
                { from: "18:00", to: "22:00", kind: "scheduled", label: "Chill tối" },
                { from: "22:00", to: "23:00", kind: "fallback", title: "Acoustic cuối tuần" },
                { from: "23:00", to: "24:00", kind: "default" },
              ],
            },
            {
              label: "Thứ Bảy, 3 thg 10",
              segments: [
                { from: "00:00", to: "20:00", kind: "default", label: "mặc định" },
                { from: "20:00", to: "23:00", kind: "fallback", label: "Acoustic cuối tuần" },
                { from: "23:00", to: "24:00", kind: "default" },
              ],
            },
            {
              label: "Chủ Nhật, 4 thg 10",
              segments: [
                { from: "00:00", to: "08:00", kind: "none", label: "không có gì để phát" },
                { from: "08:00", to: "24:00", kind: "default", label: "mặc định" },
              ],
            },
          ]}
        />
      </div>
    );
  },
};

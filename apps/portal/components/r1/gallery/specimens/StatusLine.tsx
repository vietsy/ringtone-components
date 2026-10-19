"use client";

import { StatusLine, format } from "../..";
import type { Specimen } from "../specimen";

export const StatusLineSpecimen: Specimen = {
  name: "StatusLine",
  group: "Status",
  height: 130,
  render() {
    return (
      <div className="pv">
        <StatusLine
          family="info"
          text={"Đang đồng bộ từ " + format.timestamp("2026-09-28T12:38:00+07:00")}
          cutout="surface"
        />
        <StatusLine
          family="attention"
          text="Bộ nhớ còn 1,2 GB"
          detail="Khi đầy, thiết bị ngừng tải bài mới nhưng vẫn phát bài đã có."
          cutout="surface"
        />
      </div>
    );
  },
};

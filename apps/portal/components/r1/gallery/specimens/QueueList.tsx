"use client";

import { QueueList } from "../..";
import type { Specimen } from "../specimen";

export const QueueListSpecimen: Specimen = {
  name: "QueueList",
  group: "Operations",
  height: 272,
  render() {
    return (
      <div className="pv" style={{ display: "block" }}>
        <QueueList
          label="Quyết định xử lý đang mở"
          activeIndex={1}
          items={[
            {
              title: "DSP-0104",
              meta: "PLY-0031, 6 minh chứng, sai lệch toàn vẹn IF-0331",
              status: { family: "attention", label: "Đang xem xét" },
              age: "13 ngày",
            },
            {
              title: "DSP-0098",
              meta: "PLY-0009, 214 minh chứng, thiết bị báo mất",
              status: { family: "attention", label: "Mới nêu" },
              age: "16 ngày",
              checked: true,
            },
            {
              title: "DSP-0103",
              meta: "PLY-0023, 4 minh chứng, đồng hồ lệch 41 phút",
              status: { family: "attention", label: "Mới nêu" },
              age: "14 ngày",
            },
          ]}
        />
      </div>
    );
  },
};

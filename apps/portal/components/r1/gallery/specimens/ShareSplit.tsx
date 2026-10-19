"use client";

import { ShareSplit } from "../..";
import type { Specimen } from "../specimen";

export const ShareSplitSpecimen: Specimen = {
  name: "ShareSplit",
  group: "Forms",
  height: 310,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          alignItems: "start",
          gap: "var(--space-8)",
        }}
      >
        <ShareSplit
          legend="Quyền tác giả: Hẹn thứ Bảy"
          helper="Tỉ lệ của mỗi người trong phần quyền tác giả."
          parties={[
            { name: "Phan Gia Huy", detail: "Sáng tác", share: 50 },
            { name: "Trần Mỹ Diệp", detail: "Lời", share: 37.5 },
          ]}
        />
        <ShareSplit
          legend="Quyền liên quan: Hẹn thứ Bảy"
          readOnly={true}
          parties={[
            { name: "Vy Sa", detail: "Trình bày", share: 60 },
            { name: "Võ Duy Khê", detail: "Sản xuất bản ghi", share: 40 },
          ]}
        />
      </div>
    );
  },
};

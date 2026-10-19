"use client";

import { TimeField } from "../..";
import type { Specimen } from "../specimen";

export const TimeFieldSpecimen: Specimen = {
  name: "TimeField",
  group: "Forms",
  height: 256,
  render() {
    return (
      <div
        className="pv"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "flex-start" }}
      >
        <TimeField label="Giờ bắt đầu" value="11:00" required={true} />
        <TimeField label="Giờ kết thúc" value="24:00" endOfDay={true} required={true} />
        <TimeField label="Giờ đổi danh sách" value="18:15" step={15} />
        <TimeField
          label="Giờ kết thúc"
          value="10:00"
          required={true}
          helper={false}
          error="Giờ kết thúc phải sau 11:00."
        />
      </div>
    );
  },
};

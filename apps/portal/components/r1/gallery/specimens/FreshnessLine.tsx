"use client";

import { FreshnessLine } from "../..";
import type { Specimen } from "../specimen";

export const FreshnessLineSpecimen: Specimen = {
  name: "FreshnessLine",
  group: "Values",
  height: 128,
  render() {
    return (
      <div className="pv">
        <FreshnessLine
          period={{ from: "2026-06-01", to: "2026-06-30" }}
          asOf="2026-07-01T02:00:00+07:00"
          cadence="Cập nhật hằng ngày lúc 02:00"
        />
        <FreshnessLine asOf="2026-09-29T09:30:00+07:00" />
        <FreshnessLine />
      </div>
    );
  },
};

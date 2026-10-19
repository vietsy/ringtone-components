"use client";

import { BulkBar } from "../..";
import type { Specimen } from "../specimen";

export const BulkBarSpecimen: Specimen = {
  name: "BulkBar",
  group: "Operations",
  height: 100,
  render() {
    return (
      <div className="pv">
        <BulkBar
          count={3}
          total={14}
          actions={[{ label: "Giao cho tôi", variant: "primary" }, { label: "Đổi hạn xử lý" }]}
        />
      </div>
    );
  },
};

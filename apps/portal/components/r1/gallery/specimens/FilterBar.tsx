"use client";

import { FilterBar, Select } from "../..";
import type { Specimen } from "../specimen";

export const FilterBarSpecimen: Specimen = {
  name: "FilterBar",
  group: "Forms",
  height: 170,
  render() {
    return (
      <div className="pv">
        <FilterBar
          summary="12 trong 46 thiết bị"
          active={true}
          chips={[{ label: "Tình trạng: Mất kết nối" }, { label: "Nhà cung cấp: Hạt Âm Devices" }]}
          locale="vi"
        >
          <Select
            label="Tình trạng"
            value="off"
            options={[
              { value: "all", label: "Tất cả" },
              { value: "on", label: "Đang phát" },
              { value: "off", label: "Mất kết nối" },
              { value: "lim", label: "Chạm giới hạn ngoại tuyến" },
              { value: "stop", label: "Đã dừng" },
            ]}
            density="console"
            width="var(--space-48)"
          />
          <Select
            label="Nhà cung cấp"
            value="all"
            options={[
              { value: "all", label: "Tất cả" },
              { value: "h", label: "Hạt Âm Devices" },
              { value: "s", label: "Sóng Chín Audio" },
              { value: "p", label: "Phím Gỗ Audio" },
              { value: "m", label: "Hạt Mưa Audio" },
            ]}
            density="console"
            width="var(--space-48)"
          />
        </FilterBar>
      </div>
    );
  },
};

"use client";

import { SearchField } from "../..";
import type { Specimen } from "../specimen";

export const SearchFieldSpecimen: Specimen = {
  name: "SearchField",
  group: "Forms",
  height: 250,
  render() {
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <SearchField
          label="Tìm thiết bị"
          placeholder="Mã thiết bị, cơ sở hoặc mã tham chiếu"
          shortcut="⌘K"
          density="console"
        />
        <SearchField label="Tìm thiết bị" value="PLY-00" loading={true} density="console" />
        <SearchField label="Tìm bài hát" hideLabel={true} value="Hẹn thứ" placeholder="Tên bài hoặc người trình bày" />
        <SearchField label="Tìm đơn đăng ký" value="R1" error="Nhập ít nhất 3 ký tự để tìm." />
      </div>
    );
  },
};

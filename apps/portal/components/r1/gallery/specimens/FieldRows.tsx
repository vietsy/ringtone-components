"use client";

import { FieldRow, FieldRows, Select, TextField } from "../..";
import type { Specimen } from "../specimen";

export const FieldRowsSpecimen: Specimen = {
  name: "FieldRows",
  group: "Forms",
  height: 512,
  render() {
    const rights = [
      { value: "perf", label: "Biểu diễn công cộng" },
      { value: "rep", label: "Sao chép" },
      { value: "dist", label: "Phân phối" },
      { value: "comm", label: "Truyền đạt đến công chúng" },
      { value: "rent", label: "Cho thuê" },
    ];
    const regions = [
      { value: "hcm", label: "TP. Hồ Chí Minh" },
      { value: "hn", label: "Hà Nội" },
      { value: "hp", label: "Hải Phòng" },
      { value: "dn", label: "Đà Nẵng" },
      { value: "hue", label: "Huế" },
      { value: "ct", label: "Cần Thơ" },
    ];
    return (
      <div className="pv" style={{ maxWidth: "var(--container-3xl)" }}>
        <FieldRows
          legend="Quyền được uỷ thác"
          required={true}
          helper="Mỗi dòng là một loại quyền trên một vùng."
          max={5}
        >
          <FieldRow title="Dòng 1" columns={3}>
            <Select label="Loại quyền" value="perf" options={rights} />
            <Select label="Vùng" value="hcm" options={regions} />
            <TextField label="Phần tác phẩm" value="*" mono={true} />
          </FieldRow>
          <FieldRow title="Dòng 2" columns={3}>
            <Select label="Loại quyền" value="perf" options={rights} />
            <Select label="Vùng" value="" placeholder="Chọn vùng" options={regions} error="Chọn vùng áp dụng." />
            <TextField label="Phần tác phẩm" value="*" mono={true} />
          </FieldRow>
        </FieldRows>
      </div>
    );
  },
};

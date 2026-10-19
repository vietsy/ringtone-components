"use client";

import { FieldRow, Select, TextField } from "../..";
import type { Specimen } from "../specimen";

export const FieldRowSpecimen: Specimen = {
  name: "FieldRow",
  group: "Forms",
  height: 520,
  render() {
    return (
      <div className="pv" style={{ maxWidth: "var(--container-3xl)" }}>
        <FieldRow title="Liên hệ 1" columns={2}>
          <TextField label="Họ và tên" value="Đỗ Thu Trang" />
          <TextField label="Email" value="trang.do@thencua.example" type="email" />
        </FieldRow>
        {/* Figma's Columns=1, at the 448 px Figma draws it: the fields one under the other. */}
        <div style={{ maxWidth: "var(--container-md)" }}>
          <FieldRow title="Dòng 1" columns={1}>
            <Select
              label="Loại quyền"
              value="public"
              options={[
                { value: "public", label: "Biểu diễn công cộng" },
                { value: "copy", label: "Sao chép" },
              ]}
            />
            <Select
              label="Vùng"
              value="hcm"
              options={[
                { value: "hcm", label: "TP. Hồ Chí Minh" },
                { value: "hn", label: "Hà Nội" },
              ]}
            />
            <TextField label="Phần tác phẩm" value="*" />
          </FieldRow>
        </div>
      </div>
    );
  },
};

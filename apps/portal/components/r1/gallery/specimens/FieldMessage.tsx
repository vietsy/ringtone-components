"use client";

import { FieldMessage } from "../..";
import type { Specimen } from "../specimen";

export const FieldMessageSpecimen: Specimen = {
  name: "FieldMessage",
  group: "Forms",
  height: 140,
  render() {
    return (
      <div className="pv" style={{ display: "grid", gap: "var(--space-2)" }}>
        <FieldMessage severity="error">Nhập mã số thuế gồm 10 hoặc 13 chữ số.</FieldMessage>
        <FieldMessage severity="warning" acknowledgeable={true}>
          Cơ sở này có thể trùng một hồ sơ đã có.
        </FieldMessage>
        <FieldMessage severity="info">Giá trị này lấy từ chính sách phiên bản 2.</FieldMessage>
      </div>
    );
  },
};

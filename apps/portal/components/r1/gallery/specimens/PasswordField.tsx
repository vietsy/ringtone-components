"use client";

import { PasswordField } from "../..";
import type { Specimen } from "../specimen";

export const PasswordFieldSpecimen: Specimen = {
  name: "PasswordField",
  group: "Forms",
  height: 290,
  render() {
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <PasswordField
          label="Mật khẩu mới"
          required={true}
          value="rightone2027"
          autoComplete="new-password"
          rules={[
            { text: "Ít nhất 12 ký tự", met: true },
            { text: "Có cả chữ và số", met: true },
            { text: "Khác 5 mật khẩu gần nhất", met: false },
          ]}
        />
        <PasswordField label="Mật khẩu" value="mây sông 1957" revealed={true} />
        <PasswordField
          label="Mật khẩu hiện tại"
          required={true}
          value=""
          error="Nhập mật khẩu hiện tại để đặt mật khẩu mới."
        />
      </div>
    );
  },
};

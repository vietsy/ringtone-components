"use client";

import { Switch } from "../..";
import type { Specimen } from "../specimen";

export const SwitchSpecimen: Specimen = {
  name: "Switch",
  group: "Forms",
  height: 480,
  render() {
    return (
      <div className="pv" style={{ maxWidth: "var(--container-md)" }}>
        <Switch
          label="Thông báo qua email"
          helper="Khi đơn đăng ký cần bổ sung hoặc khoản thanh toán sắp đến hạn."
          checked={true}
        />
        <Switch label="Tin nhắn SMS" />
        <Switch label="Thông báo đẩy trên điện thoại" checked={true} loading={true} />
        <Switch label="Báo khi có bản cập nhật" error="Chưa lưu được thay đổi. Thử lại sau ít phút." />
        <Switch
          label="Thông báo về giấy xác nhận"
          checked={true}
          disabled={true}
          disabledReason="Thông báo này bắt buộc nên không tắt được."
        />
        <Switch label="Tự cập nhật phần mềm Player" checked={true} density="console" />
      </div>
    );
  },
};

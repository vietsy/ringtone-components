"use client";

import { Checkbox, format } from "../..";
import type { Specimen } from "../specimen";

export const CheckboxSpecimen: Specimen = {
  name: "Checkbox",
  group: "Forms",
  height: 336,
  render() {
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <Checkbox label="Gửi báo cáo tuần qua email" helper="Mỗi thứ Hai, 08:00 (GMT+7)." checked={true} />
        <Checkbox
          label="Tôi đã đọc hết điều khoản phiên bản 3"
          required={true}
          error="Cần xác nhận đã đọc điều khoản trước khi gửi."
          density="portal"
        />
        <Checkbox
          label="Tự gia hạn quyền sử dụng"
          disabled={true}
          disabledReason="Cơ sở đang tạm ngừng nên chưa gia hạn được."
        />
        <Checkbox
          label="Phát cả bảy ngày trong tuần"
          indeterminate={true}
          disabled={true}
          disabledReason="Lịch này do chuỗi cơ sở đặt nên chi nhánh không đổi được."
        />
        <Checkbox
          label="Mã số thuế đã được xác minh"
          helper="Theo sổ đăng ký doanh nghiệp."
          checked={true}
          readOnly={true}
        />
        <Checkbox
          layout="card"
          density="portal"
          label="Tôi chấp nhận điều khoản dịch vụ Player phiên bản 3"
          helper={"Có hiệu lực từ " + format.date("2026-10-01") + "."}
          checked={true}
        />
      </div>
    );
  },
};

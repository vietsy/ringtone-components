"use client";

import { Stepper } from "../..";
import type { Specimen } from "../specimen";

export const StepperSpecimen: Specimen = {
  name: "Stepper",
  group: "Flows",
  height: 150,
  render() {
    return (
      <div className="pv" style={{ display: "block" }}>
        <Stepper
          label="Đăng ký cơ sở"
          savedAt="2026-09-28T14:02:00+07:00"
          steps={[
            { label: "Xác định cơ sở", state: "done", href: "#" },
            { label: "Xác nhận phân loại", state: "done", href: "#" },
            { label: "Khai thông tin", state: "current" },
            {
              label: "Đọc phí và cam kết",
              state: "blocked",
              reason: "Biểu phí cho trường hợp này chưa được phê duyệt.",
            },
            { label: "Gửi hồ sơ" },
          ]}
        />
      </div>
    );
  },
};

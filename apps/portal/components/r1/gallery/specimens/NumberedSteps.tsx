"use client";

import { NumberedSteps } from "../..";
import type { Specimen } from "../specimen";

export const NumberedStepsSpecimen: Specimen = {
  name: "NumberedSteps",
  group: "Flows",
  height: 180,
  render() {
    return (
      <div className="pv">
        <NumberedSteps
          title="Lấy mã ghép"
          steps={[
            "Chủ cơ sở mở Player › Thiết bị trong cổng cơ sở.",
            "Tạo một mã ghép. Mỗi mã chỉ dùng được một lần.",
            "Nhập 12 chữ cái và chữ số của mã vào các ô mã ghép.",
          ]}
        />
      </div>
    );
  },
};

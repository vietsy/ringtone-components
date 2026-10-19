"use client";

import { StatStrip } from "../..";
import type { Specimen } from "../specimen";

export const StatStripSpecimen: Specimen = {
  name: "StatStrip",
  group: "Data",
  height: 304,
  render() {
    return (
      <div className="pv">
        <StatStrip
          items={[
            { value: 43, label: "đang hoạt động", family: "positive" },
            { value: 1, label: "mới đăng ký" },
            { value: 1, label: "đã báo mất", family: "danger", emphasis: true },
            { value: 1, label: "đã ngừng dùng" },
          ]}
        />
        <StatStrip
          columns={4}
          items={[
            { value: 1284, label: "đơn đăng ký và vụ việc" },
            { value: 892, label: "khoản tiền" },
            { value: 0, label: "quyền và yêu cầu" },
            { value: 340, label: "giấy xác nhận" },
            { value: 2, label: "kỳ phân phối" },
            { value: 6, label: "báo cáo" },
            { value: null, label: "điểm cấu hình", note: "Chưa đọc được từ cấu hình" },
          ]}
        />
      </div>
    );
  },
};

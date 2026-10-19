"use client";

import { ChoiceList } from "../..";
import type { Specimen } from "../specimen";

export const ChoiceListSpecimen: Specimen = {
  name: "ChoiceList",
  group: "Forms",
  height: 620,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, var(--container-xs)), 1fr))",
          alignItems: "start",
        }}
      >
        <ChoiceList
          legend="Các minh chứng chưa đồng bộ"
          required={true}
          options={[
            { value: "s", label: "Gửi về The Lintel Coffee – Lý Tự Trọng, nơi đã phát" },
            { value: "d", label: "Huỷ các minh chứng này" },
          ]}
          error="Chọn cách xử lý 412 minh chứng."
        />
        <ChoiceList
          legend="Ngày trong tuần"
          multiple={true}
          layout="chips"
          density="portal"
          value={["t7", "cn"]}
          options={[
            { value: "t2", label: "T2" },
            { value: "t3", label: "T3" },
            { value: "t4", label: "T4" },
            { value: "t5", label: "T5" },
            { value: "t6", label: "T6" },
            { value: "t7", label: "T7" },
            { value: "cn", label: "CN" },
          ]}
        />
        <ChoiceList
          legend="Kết quả"
          layout="inline"
          value="s"
          error="Chưa dừng được: thiết bị đang phát cho khách. Chọn Tạm dừng."
          options={[
            { value: "g", label: "Đi tiếp" },
            { value: "p", label: "Tạm dừng" },
            { value: "r", label: "Khắc phục" },
            { value: "s", label: "Dừng" },
          ]}
        />
        <ChoiceList
          legend="Loại cơ sở"
          readOnly={true}
          value="cafe"
          helper="Theo sổ đăng ký kinh doanh."
          options={[
            { value: "cafe", label: "Quán cà phê" },
            { value: "rest", label: "Nhà hàng" },
          ]}
        />
        <ChoiceList
          legend="Kết quả kiểm tra tại chỗ"
          layout="cards"
          density="portal"
          value="add"
          options={[
            { value: "ok", label: "Đạt", family: "positive", helper: "Nhạc đang phát khớp với giấy xác nhận." },
            {
              value: "add",
              label: "Cần bổ sung",
              family: "attention",
              helper: "Cơ sở bổ sung giấy tờ trong 7 ngày làm việc.",
            },
            {
              value: "no",
              label: "Không đạt",
              family: "danger",
              helper: "Ghi lại và chuyển cho bộ phận xử lý vi phạm.",
            },
          ]}
        />
        <ChoiceList
          legend="Tình trạng thiết bị"
          density="console"
          value="on"
          options={[
            { value: "on", label: "Đang hoạt động", family: "positive" },
            { value: "off", label: "Mất kết nối, vẫn phát", family: "info" },
            { value: "lost", label: "Đã báo mất", family: "danger" },
          ]}
        />
      </div>
    );
  },
};

"use client";

import { Toast, format } from "../..";
import type { Specimen } from "../specimen";

export const ToastSpecimen: Specimen = {
  name: "Toast",
  group: "Feedback",
  height: 508,
  render() {
    return (
      <div className="pv">
        <Toast title="Đã lưu lịch phát" action={{ label: "Xem lịch" }}>
          {"Chill tối, thứ Hai đến thứ Sáu, 18:00–22:00 (GMT+7), từ " + format.date("2026-10-03") + "."}
        </Toast>
        <Toast family="info" title="Đang xuất dữ liệu">
          Tệp sẽ có trong mục Tải về khi xong. Bạn có thể rời trang này.
        </Toast>
        <Toast family="attention" title="Chưa gửi được thông báo cho 3 cơ sở" action={{ label: "Xem danh sách" }} />
        <div style={{ width: "var(--container-xs)" }}>
          <Toast title="Đã gửi yêu cầu cho cơ sở">Cơ sở có 5 ngày làm việc để trả lời.</Toast>
        </div>
      </div>
    );
  },
};

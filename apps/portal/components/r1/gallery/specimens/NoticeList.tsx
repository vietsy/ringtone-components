"use client";

import { NoticeList, format } from "../..";
import type { Specimen } from "../specimen";

export const NoticeListSpecimen: Specimen = {
  name: "NoticeList",
  group: "Feedback",
  height: 312,
  render() {
    return (
      <div className="pv" style={{ maxWidth: "var(--container-2xl)" }}>
        <NoticeList
          items={[
            {
              family: "info",
              unread: true,
              title: "PLY-0031 đã mất kết nối 53 giờ 48 phút",
              body: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng. Nhạc vẫn phát; còn 18 giờ 12 phút.",
              at: "2026-09-28T12:36:00+07:00",
              href: "#",
            },
            {
              family: "attention",
              unread: true,
              title: "Hồ sơ RPS-Q4NDT7WZ2K cần bổ sung giấy phép kinh doanh",
              body: "Then Cửa Bakery – Hai Bà Trưng. Hạn bổ sung " + format.date("2026-10-06") + ".",
              at: "2026-09-28T09:05:00+07:00",
              href: "#",
            },
            {
              family: "positive",
              title: "Đã nhận thanh toán kỳ 4 năm 2026",
              body: "Then Cửa Coffee & Tea – Pasteur, " + format.money(822750) + ".",
              at: "2026-09-27T16:20:00+07:00",
              href: "#",
            },
          ]}
        />
      </div>
    );
  },
};

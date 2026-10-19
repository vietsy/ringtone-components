"use client";

import { NavList } from "../..";
import type { Specimen } from "../specimen";

export const NavListSpecimen: Specimen = {
  name: "NavList",
  group: "Page",
  height: 312,
  render() {
    return (
      <div className="pv">
        <NavList
          title="Phát nhạc"
          items={[
            {
              label: "Danh sách phát",
              href: "#",
              icon: "list-music",
              detail: "4 danh sách, mặc định: Sáng mở cửa",
              current: true,
            },
            { label: "Lịch phát", href: "#", icon: "calendar", detail: "3 lịch đang áp dụng" },
            { label: "Thiết bị", href: "#", icon: "tablet", detail: "3 thiết bị đã ghép" },
            {
              label: "Nội dung thay thế",
              icon: "history",
              disabled: true,
              reason: "Chưa có lần phát nào để đối chiếu.",
            },
          ]}
        />
      </div>
    );
  },
};

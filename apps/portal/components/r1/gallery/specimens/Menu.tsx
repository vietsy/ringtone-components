"use client";

import { Menu } from "../..";
import type { Specimen } from "../specimen";

export const MenuSpecimen: Specimen = {
  name: "Menu",
  group: "Actions",
  height: 330,
  render() {
    return (
      <div
        className="pv"
        style={{ flexDirection: "row", gap: "var(--space-12)", alignItems: "flex-start", minHeight: "var(--space-72)" }}
      >
        <Menu
          label="Thao tác"
          open={true}
          items={[
            { label: "Xuất hồ sơ thiết bị", icon: "download" },
            { label: "Chuyển sang cơ sở khác", icon: "arrow-right-left" },
            {
              label: "Đổi tình trạng",
              icon: "refresh-cw",
              disabled: true,
              reason: "Thiết bị đã báo mất không đổi tình trạng được.",
            },
            { separator: true },
            { label: "Ngừng dùng PLY-0009", icon: "power", danger: true },
          ]}
        />
        <Menu
          label="Cột"
          icon="layout-dashboard"
          open={true}
          items={[
            { label: "Thiết bị", checked: true, disabled: true, reason: "Cột nhận diện luôn hiện." },
            { label: "Cơ sở", checked: true },
            { label: "Tình trạng", checked: true },
            { label: "Nhà cung cấp", checked: false },
            { label: "Kết nối gần nhất", checked: true },
          ]}
        />
        <Menu iconOnly={true} label="Thao tác với PLY-0023" variant="quiet" items={[{ label: "Xem thiết bị" }]} />
      </div>
    );
  },
};

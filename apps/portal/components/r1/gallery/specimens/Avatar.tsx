"use client";

import { Avatar } from "../..";
import type { Specimen } from "../specimen";

export const AvatarSpecimen: Specimen = {
  name: "Avatar",
  group: "Values",
  height: 110,
  render() {
    return (
      <div className="pv" style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-4)" }}>
        <Avatar name="Đỗ Thu Trang" size="lg" />
        <Avatar name="Vy Sa" size="md" />
        <Avatar name="Lê Đăng Quý" size="sm" />
        <Avatar name="Công ty TNHH Then Cửa Việt" kind="org" size="lg" />
        <Avatar name="Hạt Âm Devices" kind="org" size="md" />
      </div>
    );
  },
};

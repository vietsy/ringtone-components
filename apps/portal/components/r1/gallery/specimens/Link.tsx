"use client";

import { Link } from "../..";
import type { Specimen } from "../specimen";

export const LinkSpecimen: Specimen = {
  name: "Link",
  group: "Page",
  height: 120,
  render() {
    return (
      <div
        className="pv"
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: "var(--space-6)" }}
      >
        <Link href="#" back={true} variant="standalone">
          Quay lại dịch vụ
        </Link>
        <Link href="#">Xem lịch phát</Link>
        <Link href="https://example.org" external={true} locale="vi">
          Trang chuẩn công khai
        </Link>
        <Link href="#" variant="quiet" size="sm">
          Cách RightOne quyết định
        </Link>
        <Link href="#" variant="standalone" size="touch">
          Đăng ký cơ sở
        </Link>
        <Link href="#" current={true}>
          Tổng quan
        </Link>
        <span style={{ width: "var(--space-40)" }}>
          <Link href="#">Xem quyết định OBD-3FJW6NRA5C</Link>
        </span>
      </div>
    );
  },
};

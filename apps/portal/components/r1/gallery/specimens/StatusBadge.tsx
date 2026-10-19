"use client";

import { StatusBadge } from "../..";
import type { Specimen } from "../specimen";

export const StatusBadgeSpecimen: Specimen = {
  name: "StatusBadge",
  group: "Status",
  height: 240,
  render() {
    return (
      <div className="pv">
        <StatusBadge family="positive" label="Đang hoạt động" />
        <StatusBadge family="attention" label="Tạm giữ" />
        <StatusBadge family="danger" label="Đã báo mất" />
        <StatusBadge family="neutral" label="Đã ngừng dùng" />
        <StatusBadge family="info" label="Mất kết nối, vẫn phát" />
        <StatusBadge variant="seal" label="Giấy xác nhận: đã hoàn thành nghĩa vụ" size="lg" />
        <StatusBadge family="info" label="Quyền sử dụng dịch vụ còn hiệu lực" size="sm" />
        <div style={{ width: "var(--space-40)" }}>
          <StatusBadge family="attention" label="Chờ cơ sở bổ sung giấy phép kinh doanh" size="sm" />
        </div>
        <StatusBadge family="danger" label="Tạm đình chỉ" icon="clock" />
        <StatusBadge family="danger" label="Đã thu hồi" icon="ban" />
        <StatusBadge family="danger" label="Đã thu hồi" icon="ban" size="sm" />
        {/* Figma's Show shape off: the word and the tint, no shape. */}
        <StatusBadge family="positive" label="Đang hoạt động" showShape={false} />
        <StatusBadge family="attention" label="Tạm giữ" size="sm" showShape={false} />
        <StatusBadge family="info" label="Mất kết nối, vẫn phát" size="lg" showShape={false} />
      </div>
    );
  },
};

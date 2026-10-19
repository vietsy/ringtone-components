"use client";

import { FactList } from "../..";
import type { Specimen } from "../specimen";

export const FactListSpecimen: Specimen = {
  name: "FactList",
  group: "Values",
  height: 296,
  render() {
    return (
      <div className="pv" style={{ display: "block" }}>
        <FactList
          columns={2}
          items={[
            { label: "Thiết bị", value: "PLY-0009", kind: "id" },
            {
              label: "Định danh do IAM cấp",
              value: "dev-8f21-44",
              kind: "mono",
              provenance: "registry-sourced",
              provenanceDetail: "IAM",
            },
            { label: "Khoá ký của bản in", value: "r1-sig-2026-09-7QK2MVD4TN8WHX5JRC3PB6YFZ9LGS1", kind: "mono" },
            { label: "Nhà cung cấp", value: "Hạt Âm Devices", action: { label: "Sửa" } },
            { label: "Tình trạng", value: { family: "danger", label: "Đã báo mất" }, kind: "status" },
            {
              label: "Hiệu lực từ",
              value: "2026-09-10T14:00:00+07:00",
              kind: "datetime",
              note: "Thời điểm chủ cơ sở cho biết thiết bị bị mất.",
            },
            { label: "Minh chứng đang tạm giữ", value: 214, kind: "count" },
            { label: "Ngày thu hồi", value: null, kind: "date", missing: "Chưa thu hồi" },
          ]}
        />
      </div>
    );
  },
};

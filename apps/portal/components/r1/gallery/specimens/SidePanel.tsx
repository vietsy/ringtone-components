"use client";

import { FactList, SidePanel } from "../..";
import type { Specimen } from "../specimen";

export const SidePanelSpecimen: Specimen = {
  name: "SidePanel",
  group: "Page",
  height: 470,
  render() {
    return (
      <div style={{ display: "flex", height: "calc(var(--space-96) + var(--space-12))", background: "var(--page)" }}>
        <div style={{ flex: 1 }} />
        <div style={{ width: "var(--container-sm)" }}>
          <SidePanel
            eyebrow="Thiết bị"
            title="PLY-0031"
            status={{ family: "info", label: "Mất kết nối, vẫn phát" }}
            actions={[{ label: "Mở trang thiết bị" }, { label: "Nhắc cơ sở" }]}
          >
            <FactList
              items={[
                { label: "Cơ sở", value: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng" },
                { label: "Mất kết nối từ", value: "2026-09-26T06:48:00+07:00", kind: "datetime" },
                { label: "Minh chứng chờ gửi", value: 614, kind: "count" },
              ]}
            />
          </SidePanel>
        </div>
      </div>
    );
  },
};

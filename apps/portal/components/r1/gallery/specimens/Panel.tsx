"use client";

import { FactList, Link, Panel, StatusBadge } from "../..";
import type { Specimen } from "../specimen";

export const PanelSpecimen: Specimen = {
  name: "Panel",
  group: "Page",
  height: 330,
  render() {
    return (
      <div className="pv" style={{ background: "var(--page)" }}>
        <Panel
          title="Thiết bị của cơ sở"
          description={"Ba thiết bị đã ghép với Then Cửa Coffee & Tea – Pasteur."}
          actions={[{ label: "Đăng ký thiết bị", icon: "plus" }]}
          density="portal"
        >
          <FactList
            items={[
              { label: "Đang phát", value: 2, kind: "count" },
              { label: "Mất kết nối", value: 1, kind: "count" },
            ]}
          />
        </Panel>
        <Panel layout="strip">
          <span>Danh sách mặc định</span>
          <StatusBadge family="neutral" label="Dùng được" size="sm" />
          <Link href="#" variant="standalone">
            Đổi danh sách mặc định
          </Link>
        </Panel>
      </div>
    );
  },
};

"use client";

import { PortalShell, format } from "../..";
import type { Specimen } from "../specimen";

export const PortalShellSpecimen: Specimen = {
  name: "PortalShell",
  group: "Shells",
  height: 360,
  render() {
    return (
      <div style={{ height: "var(--space-80)" }}>
        <PortalShell
          account="Trần Thị Mỹ Hạnh"
          nav={[
            { label: "Cơ sở" },
            { label: "Đăng ký" },
            { label: "Thanh toán" },
            { label: "Giấy xác nhận" },
            { label: "Player", current: true },
            { label: "Vụ việc" },
          ]}
          context={{
            premises: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng",
            period: format.period("2026-09-01", "2026-09-30")!,
          }}
        >
          <h1 className="r1-page-title">Thiết bị Player</h1>
        </PortalShell>
      </div>
    );
  },
};

"use client";

import { Tabs } from "../..";
import type { Specimen } from "../specimen";

export const TabsSpecimen: Specimen = {
  name: "Tabs",
  group: "Page",
  height: 170,
  render() {
    return (
      <div className="pv">
        <Tabs
          label="Hồ sơ cơ sở"
          value="dev"
          tabs={[
            { id: "ov", label: "Tổng quan" },
            { id: "dev", label: "Thiết bị", count: 3 },
            { id: "pay", label: "Thanh toán", count: 0 },
            { id: "his", label: "Lịch sử" },
          ]}
        >
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-sm)",
              lineHeight: "var(--leading-sm)",
              color: "var(--on-surface-secondary)",
            }}
          >
            {"Ba thiết bị đã ghép với Then Cửa Coffee & Tea – Pasteur."}
          </p>
        </Tabs>
        <Tabs
          label="Hàng chờ"
          density="console"
          value="open"
          tabs={[
            { id: "open", label: "Đang mở", count: 14 },
            { id: "mine", label: "Của tôi", count: 3 },
            { id: "done", label: "Đã xử lý" },
          ]}
        />
      </div>
    );
  },
};

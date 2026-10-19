"use client";

import { Button, Divider, Panel, TextField } from "../..";
import type { Specimen } from "../specimen";

export const DividerSpecimen: Specimen = {
  name: "Divider",
  group: "Page",
  height: 520,
  render() {
    return (
      <div className="pv">
        <Panel gap="xl" density="portal">
          <Panel variant="plain" title="Tổ chức" density="portal">
            <TextField
              label="Tên pháp lý"
              value="Dây Đàn Rights Agency"
              readOnly={true}
              provenance="registry-sourced"
              name="legal_name"
            />
          </Panel>
          <Divider />
          <Panel variant="plain" title="Chứng minh thẩm quyền" density="portal">
            <TextField
              label="Số tham chiếu trong sổ thẩm quyền"
              value="CV-2026-0472"
              required={true}
              mono={true}
              name="authority_evidence_ref"
            />
          </Panel>
          <Divider />
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <Button variant="primary">Nộp đơn</Button>
            <Button>Lưu bản nháp</Button>
          </div>
        </Panel>
      </div>
    );
  },
};

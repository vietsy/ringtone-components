"use client";

import { Columns, FactList, Panel, Select, TextField } from "../..";
import type { Specimen } from "../specimen";

const CHANNELS = [
  { value: "api", label: "API trực tiếp" },
  { value: "csv", label: "Tệp CSV" },
];
const FORMATS = [
  { value: "json", label: "JSON" },
  { value: "cwr", label: "Tệp CWR (chưa thoả thuận)" },
];

export const ColumnsSpecimen: Specimen = {
  name: "Columns",
  group: "Page",
  height: 980,
  render() {
    return (
      <div className="pv" style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <Columns>
          <Panel title="Đơn này chưa được gửi" density="portal">
            <FactList
              items={[
                { label: "Cơ sở", value: "Then Cửa Tea House, Khu đô thị Sala" },
                { label: "Lưu lúc", value: "29 thg 9, 2026, 16:42 (GMT+7)" },
              ]}
              density="portal"
            />
          </Panel>
          <Panel as="aside" title="Đơn này" density="portal">
            <FactList
              items={[
                { label: "Mã đơn", value: "REG-P5TJ4BXC7M", kind: "id" },
                { label: "Loại đơn", value: "Đăng ký lần đầu" },
              ]}
              density="portal"
            />
          </Panel>
        </Columns>
        <Columns layout="halves">
          <Select
            label="Kênh"
            helper="Các kênh đã thoả thuận: API trực tiếp và tệp CSV. Kênh khác chỉ dùng được sau khi được thêm vào sổ kênh."
            options={CHANNELS}
            value="api"
            name="channel"
          />
          <Select label="Định dạng" helper="Theo hồ sơ kỹ thuật của kênh đã chọn." options={FORMATS} value="json" name="format" />
        </Columns>
        <Columns layout="thirds" template="minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)">
          <TextField label="Tên pháp lý" value="Hội Quyền tác giả Âm nhạc Lam Hồng" readOnly={true} name="legal_name" />
          <TextField label="Mã chủ thể" value="PTY-6QW2K8MD" readOnly={true} mono={true} name="party" />
          <TextField label="Loại" value="Tổ chức quản lý tập thể" readOnly={true} name="kind" />
        </Columns>
      </div>
    );
  },
};

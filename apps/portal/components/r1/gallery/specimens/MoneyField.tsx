"use client";

import { MoneyField } from "../..";
import type { Specimen } from "../specimen";

export const MoneyFieldSpecimen: Specimen = {
  name: "MoneyField",
  group: "Forms",
  height: 130,
  render() {
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", alignItems: "start" }}
      >
        <MoneyField label="Số tiền điều chỉnh" required={true} amountMinor={12500000} density="console" />
        <MoneyField label="Số tiền hoàn lại" required={true} error="Nhập số tiền lớn hơn 0." density="console" />
        <MoneyField label="Đã thu" readOnly={true} amountMinor={3290998} density="console" />
      </div>
    );
  },
};

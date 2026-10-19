"use client";

import { CodeInput } from "../..";
import type { Specimen } from "../specimen";

export const CodeInputSpecimen: Specimen = {
  name: "CodeInput",
  group: "Forms",
  height: 440,
  render() {
    return (
      <div
        className="pv"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "flex-start" }}
      >
        <CodeInput label="Mã xác thực" digits={["4", "8", "1"]} focus={3} locale="vi" />
        <CodeInput
          label="Mã xác thực"
          value="481905"
          error="Mã này đã hết hạn. Nhập mã mới đang hiện trong ứng dụng xác thực."
          locale="vi"
        />
        <CodeInput label="Mã xác thực" value="481905" loading={true} locale="vi" />
        <CodeInput label="Mã ghép" length={12} group={4} chars="alnum" value="7QK48M2PRX51" locale="vi" />
      </div>
    );
  },
};

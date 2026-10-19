"use client";

import { Panel, SecretValue } from "../..";
import type { Specimen } from "../specimen";

export const SecretValueSpecimen: Specimen = {
  name: "SecretValue",
  group: "Values",
  height: 760,
  render() {
    const codes = [
      "8K4Q-2MZ7",
      "T9RX-5PWD",
      "3HJN-V6CE",
      "Q7LF-8YB2",
      "M2ZD-4KR9",
      "W5TC-7NHX",
      "B8YE-3QJM",
      "R6PV-9DLA",
      "F4XK-2TWG",
      "J7NB-5MCQ",
    ];
    return (
      <div className="grid">
        <Panel title="Token cá nhân đã tạo">
          <SecretValue label="Token" value="pat_Q2xpZW50U2VjcmV0VmFsdWVfOGtONHFaN3RSeDVwV2Q" locale="vi" />
        </Panel>
        <Panel title="Mã khôi phục mới">
          <SecretValue label="10 mã khôi phục, mỗi mã dùng được một lần" values={codes} locale="vi" />
        </Panel>
        <Panel title="Mã ghép thiết bị">
          <SecretValue
            label="Đọc mã này cho nhân viên tại quầy"
            value="7QK48M2PRX51"
            size="lg"
            spell={true}
            once={false}
            locale="vi"
          />
        </Panel>
        <Panel title="Mã khôi phục, đọc từng ký tự">
          <SecretValue label="3 mã khôi phục còn lại" values={codes.slice(0, 3)} size="lg" spell={true} locale="vi" />
        </Panel>
      </div>
    );
  },
};

"use client";

import { Toggletip, format } from "../..";
import type { Specimen } from "../specimen";

export const ToggletipSpecimen: Specimen = {
  name: "Toggletip",
  group: "Feedback",
  height: 230,
  render() {
    return (
      <div className="pv" style={{ minHeight: "var(--space-48)" }}>
        <p
          style={{
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            fontSize: "var(--text-sm)",
            lineHeight: "var(--leading-sm)",
          }}
        >
          Tỉ lệ chấp nhận
          <Toggletip label="Định nghĩa: Tỉ lệ chấp nhận" title="Tỉ lệ chấp nhận" open={true}>
            {"Số minh chứng được chấp nhận chia cho số minh chứng nhận được trong kỳ. Định nghĩa phiên bản 2, áp dụng từ " +
              format.date("2026-07-01") +
              "."}
          </Toggletip>
        </p>
      </div>
    );
  },
};

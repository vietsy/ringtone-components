"use client";

import { Button, Tooltip } from "../..";
import type { Specimen } from "../specimen";

export const TooltipSpecimen: Specimen = {
  name: "Tooltip",
  group: "Feedback",
  height: 120,
  render() {
    return (
      <div className="pv" style={{ flexDirection: "row", gap: "var(--space-6)", paddingTop: "var(--space-12)" }}>
        <Tooltip label="Tải hồ sơ về" open={true}>
          <Button iconOnly={true} icon="download" variant="quiet" aria-label="Tải hồ sơ về" />
        </Tooltip>
        <Tooltip label="Sao chép mã">
          <Button iconOnly={true} icon="copy" variant="quiet" aria-label="Sao chép mã" />
        </Tooltip>
        <Tooltip label="Lọc danh sách">
          <Button iconOnly={true} icon="filter" variant="quiet" aria-label="Lọc danh sách" />
        </Tooltip>
      </div>
    );
  },
};

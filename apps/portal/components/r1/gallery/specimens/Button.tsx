"use client";

import { Button } from "../..";
import type { Specimen } from "../specimen";

export const ButtonSpecimen: Specimen = {
  name: "Button",
  group: "Actions",
  height: 170,
  render() {
    return (
      <div className="pv" style={{ alignItems: "flex-start" }}>
        <Button variant="primary" icon="check">
          Ghi nhận quyết định
        </Button>
        <Button>Xem thiết bị</Button>
        <Button variant="quiet" icon="download">
          Xuất ngày
        </Button>
        <Button variant="danger">Ngừng dùng thiết bị PLY-0009</Button>
        <Button icon="download" loading={true} loadingLabel="Đang xuất">
          Xuất danh sách
        </Button>
        <Button variant="primary" disabled={true} disabledReason="Cần ghi căn cứ trước khi giải toả.">
          Giải toả
        </Button>
        <Button size="sm" icon="filter">
          Lọc
        </Button>
        <Button iconOnly={true} icon="copy" aria-label="Sao chép mã" />
      </div>
    );
  },
};

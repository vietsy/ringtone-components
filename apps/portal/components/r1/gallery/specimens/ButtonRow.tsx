"use client";

import { Button, ButtonRow, Panel, TextField } from "../..";
import type { Specimen } from "../specimen";

export const ButtonRowSpecimen: Specimen = {
  name: "ButtonRow",
  group: "Actions",
  height: 520,
  render() {
    return (
      <div className="pv">
        <ButtonRow label="Quyết định">
          <Button
            variant="primary"
            size="sm"
            icon="link"
            disabled={true}
            disabledReason="Chọn cách xử lý bản ghi thay đổi trước."
          >
            Gộp hai bản ghi
          </Button>
          <Button size="sm">Không phải cùng chủ thể</Button>
        </ButtonRow>
        <ButtonRow>
          <Button variant="primary" disabled={true} disabledReason="Nhập số đăng ký kinh doanh trước.">
            Gửi khai báo
          </Button>
          <Button disabled={true} disabledReason="Bản nháp chỉ lưu được khi có tên cơ sở.">
            Lưu bản nháp
          </Button>
          <Button variant="quiet" href="#">
            Quay lại danh sách
          </Button>
        </ButtonRow>
        <ButtonRow align="end">
          <Button size="sm">Xuất danh sách</Button>
          <Button variant="primary" size="sm">
            Mở rà soát
          </Button>
        </ButtonRow>
        <Panel title="Khai báo cơ sở">
          <TextField label="Tên cơ sở" value="Then Cửa Bakery – Hai Bà Trưng" required={true} />
          <TextField label="Diện tích phát nhạc" value="86" suffix="m²" />
          <ButtonRow sticky={true} label="Gửi khai báo">
            <Button variant="primary" fullWidth={true}>
              Gửi khai báo
            </Button>
            <Button variant="quiet" fullWidth={true}>
              Lưu bản nháp
            </Button>
          </ButtonRow>
        </Panel>
      </div>
    );
  },
};

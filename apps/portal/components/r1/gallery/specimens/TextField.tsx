"use client";

import { TextField, format } from "../..";
import type { Specimen } from "../specimen";

export const TextFieldSpecimen: Specimen = {
  name: "TextField",
  group: "Forms",
  height: 560,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, var(--container-xs)), 1fr))",
          alignItems: "start",
        }}
      >
        <TextField
          label="Mã số thuế"
          helper="Dạng 10 chữ số, hoặc 13 chữ số cho chi nhánh."
          required={true}
          value="031234567"
          error="Nhập mã số thuế gồm 10 hoặc 13 chữ số."
        />
        <TextField
          label="Tên cơ sở"
          readOnly={true}
          value={"Then Cửa Coffee & Tea – Pasteur"}
          provenance="registry-sourced"
          provenanceDetail={"Cổng ĐKKD, " + format.date("2026-09-17")}
        />
        <TextField
          label="Thời gian tối đa được phát ngoại tuyến"
          value="72"
          suffix="giờ"
          density="console"
          info="Không dài hơn giới hạn ngắn nhất trong quyền đã đồng bộ."
        />
        <TextField
          label="Địa chỉ"
          value="115 Nguyễn Huệ"
          warning="Có thể trùng với một cơ sở đã đăng ký. Đơn vẫn gửi được và sẽ được xem xét."
        />
        <TextField
          label="Giới hạn phát ngoại tuyến"
          value="72"
          suffix="giờ"
          disabled={true}
          disabledReason="Chủ sở hữu dịch vụ đặt giới hạn này."
        />
        <TextField
          label="Khoá ký webhook"
          readOnly={true}
          masked={true}
          revealable={true}
          value="whsec_9QK2T7MX4PD8RW3N"
          helper="Dùng để kiểm tra thông báo RightOne gửi đến máy chủ của bạn."
        />
        <TextField label="Số tài khoản nhận tiền" readOnly={true} masked={true} value="0071 0004 5821 8901" />
        <TextField
          label="Khoá ký webhook mới"
          masked={true}
          revealable={true}
          value="whsec_4XR8NK2WQ7"
          required={true}
        />
        {/* Figma Field/Input with its Leading icon, portal and console. */}
        <TextField label="Mã thiết bị" icon="smartphone" placeholder="PLY-0023" />
        <TextField label="Địa chỉ nhận webhook" icon="link" value="https://api.thencuaviet.vn/r1" density="console" />
        <TextField
          label="Mã thiết bị"
          icon="smartphone"
          value="PLY-23"
          error="Mã thiết bị gồm PLY- và 4 chữ số, như PLY-0023."
        />
      </div>
    );
  },
};

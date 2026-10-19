"use client";

import { Select, format } from "../..";
import type { Specimen } from "../specimen";

export const SelectSpecimen: Specimen = {
  name: "Select",
  group: "Forms",
  height: 340,
  render() {
    // The four suppliers in the device supplier register, and the premises classes of the tariff.
    const suppliers = [
      { value: "ha", label: "Hạt Âm Devices" },
      { value: "sc", label: "Sóng Chín Audio" },
      { value: "pg", label: "Phím Gỗ Audio" },
      { value: "hm", label: "Hạt Mưa Audio" },
    ];
    const classes = [
      { value: "cafe", label: "Quán cà phê" },
      { value: "rest", label: "Nhà hàng" },
      { value: "hotel", label: "Khách sạn" },
      { value: "shop", label: "Cửa hàng" },
      { value: "bake", label: "Tiệm bánh" },
      { value: "tea", label: "Quán trà" },
    ];
    const premises = [
      { value: "a", label: "Then Cửa Coffee & Tea – Pasteur" },
      { value: "b", label: "Then Cửa Coffee & Tea – Nguyễn Huệ" },
      { value: "c", label: "Then Cửa Bakery – Hai Bà Trưng" },
      { value: "d", label: "Then Cửa Coffee & Tea – Lê Thánh Tôn" },
      { value: "e", label: "Then Cửa Bakery – Đa Kao" },
      { value: "f", label: "Then Cửa Lounge & Karaoke – Bùi Viện" },
    ];
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <Select
          label="Loại cơ sở"
          value="cafe"
          options={classes}
          policy={{ name: "Biểu phí 2027", version: "1", effective: "2027-01-01" }}
          density="console"
        />
        <Select
          label="Cơ sở"
          value=""
          placeholder="Chọn cơ sở"
          options={premises}
          required={true}
          error="Chọn cơ sở mà thiết bị sẽ phát nhạc cho."
        />
        <Select
          label="Nhà cung cấp"
          value="ha"
          options={suppliers}
          disabled={true}
          disabledReason="Nhà cung cấp cố định sau khi thiết bị đã ghép."
        />
        <Select
          label="Nhà cung cấp"
          value="ha"
          options={suppliers}
          readOnly={true}
          provenance="registry-sourced"
          provenanceDetail={"Sổ thiết bị, " + format.date("2026-01-28")}
        />
        <Select label="Danh sách phát" options={[]} loading={true} />
      </div>
    );
  },
};

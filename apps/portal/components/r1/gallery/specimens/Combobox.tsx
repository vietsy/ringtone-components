"use client";

import { Combobox, format } from "../..";
import type { Specimen } from "../specimen";

export const ComboboxSpecimen: Specimen = {
  name: "Combobox",
  group: "Forms",
  height: 540,
  render() {
    // The premises one officer may pick from: 17 options, so the reader types to narrow them.
    const premises = [
      { value: "a", label: "Then Cửa Coffee & Tea – Pasteur", detail: "RPS-7K2MQXB4TD" },
      { value: "b", label: "Then Cửa Coffee & Tea – Nguyễn Huệ", detail: "RPS-W5LQ3ZK7NA" },
      { value: "c", label: "Then Cửa Bakery – Hai Bà Trưng", detail: "RPS-Q4NDT7WZ2K" },
      {
        value: "d",
        label: "Then Cửa Kitchen – Phan Xích Long",
        disabled: true,
        reason: "Dịch vụ đã kết thúc ngày " + format.date("2026-09-27") + ".",
      },
      { value: "e", label: "The Lintel Coffee – Lý Tự Trọng", detail: "RPS-H6PK2VN4XR" },
      { value: "f", label: "The Lintel Coffee – Nguyễn Trãi" },
      { value: "g", label: "The Lintel Coffee – Thảo Điền" },
      { value: "h", label: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng", detail: "RPS-M4TQ8XH2VD" },
      { value: "i", label: "Khách sạn Nắng Xiên" },
      { value: "j", label: "Áp Mái Bar – Thảo Điền" },
      { value: "k", label: "Ô Cửa Tre Lounge – Phú Mỹ Hưng" },
      { value: "l", label: "Bếp Gỗ Lim – Lê Văn Sỹ" },
      { value: "m", label: "Phở Nồi Gang – Lò Sũ", detail: "RPS-D7KQ2XN8VP" },
      { value: "n", label: "Tiệm bánh Vỏ Sò", detail: "RPS-J8TR4KC2WM" },
      { value: "o", label: "Quán Nướng Hẻm 214", detail: "RPS-N3VX7QD5HB" },
      {
        value: "p",
        label: "Nhà hàng Chay Hạt Mè – Chi nhánh Khu đô thị Sala, Phường An Khánh",
        detail: "RPS-C9MW2RT6KZ",
      },
      { value: "q", label: "Bánh mì Chị Rơm – Hội An", detail: "RPS-X5RC3NV9AJ" },
    ];
    // The 46 devices of the Player estate.
    const devices = [];
    for (let n = 1; n <= 46; n++) {
      const id = "PLY-" + ("000" + n).slice(-4);
      devices.push({ value: id, label: id });
    }
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <Combobox label="Cơ sở" required={true} query="Then" open={true} activeIndex={1} value="a" options={premises} />
        <Combobox
          label="Bài hát"
          query="Lobby Light at Noon"
          open={true}
          options={[]}
          noResults="Không có bài nào khớp. Thử gõ ít chữ hơn."
        />
        <div
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "var(--space-4)",
            marginTop: "var(--space-56)",
          }}
        >
          <Combobox
            label="Thiết bị"
            multiple={true}
            density="console"
            value={["PLY-0031", "PLY-0009"]}
            options={devices}
          />
          <Combobox
            label="Cơ sở"
            multiple={true}
            chips={false}
            density="console"
            value={["a", "e"]}
            options={premises}
          />
          <Combobox
            label="Quyết định nghĩa vụ"
            density="console"
            value="obd1"
            selectedDetail={true}
            options={[
              { value: "obd1", label: "OBD-3FJW6NRA5C", detail: "986.000 VND, hạn " + format.dateShort("2026-12-14") },
              {
                value: "obd2",
                label: "OBD-8RK4QMT2WD",
                detail: "1.250.000 VND, hạn " + format.dateShort("2026-11-30"),
              },
            ]}
          />
        </div>
      </div>
    );
  },
};

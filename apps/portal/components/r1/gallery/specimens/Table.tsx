"use client";

import { Table, format } from "../..";
import type { TableProps } from "../..";
import type { Specimen } from "../specimen";

export const TableSpecimen: Specimen = {
  name: "Table",
  group: "Data",
  height: 1880,
  render() {
    const cols: TableProps["columns"] = [
      { key: "id", label: "Thiết bị", kind: "id", sortable: true },
      { key: "prem", label: "Cơ sở", minWidth: "var(--space-56)" },
      { key: "st", label: "Tình trạng", kind: "status" },
      { key: "due", label: "Hạn xử lý", kind: "deadline", sortable: true },
      {
        key: "wait",
        label: "Chờ gửi",
        unit: "minh chứng",
        kind: "count",
        align: "end",
        sortable: true,
        help: "Số minh chứng đã ghi trên thiết bị nhưng chưa gửi được về RightOne.",
      },
      { key: "fee", label: "Phí kỳ này", unit: "VND", kind: "money", align: "end" },
      { key: "more", kind: "menu" },
    ];
    const menu = function (id: string) {
      return [
        { label: "Mở thiết bị" },
        { label: "Nhắc cơ sở" },
        { separator: true },
        { label: "Ngừng dùng " + id, danger: true },
      ];
    };
    const now = "2026-09-28T10:15:00+07:00";
    return (
      <div className="pv">
        <Table
          density="console"
          caption="Thiết bị cần xử lý"
          selectable={true}
          sort={{ key: "due", dir: "asc" }}
          sortNote="Sắp xếp theo hạn xử lý, gần nhất trước."
          selectAcross={{ total: 46, noun: "thiết bị" }}
          columns={cols}
          rows={[
            {
              _key: "c",
              _checked: true,
              _tone: "danger",
              _message: {
                severity: "error",
                text:
                  "Chứng nhận của Hạt Mưa Audio đã bị thu hồi. Lượt phát từ " +
                  format.date("2026-08-31") +
                  " không được tính.",
              },
              _href: "#",
              id: "PLY-0017",
              prem: "Áp Mái Bar – Thảo Điền",
              st: { family: "danger", label: "Chứng nhận bị thu hồi" },
              due: { due: "2026-09-26T17:00:00+07:00", now: now },
              wait: 0,
              fee: null,
              more: menu("PLY-0017"),
            },
            {
              _key: "a",
              _checked: true,
              _href: "#",
              id: "PLY-0031",
              prem: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng",
              st: { family: "info", label: "Mất kết nối, vẫn phát" },
              due: { due: "2026-09-28T16:00:00+07:00", now: now },
              wait: 614,
              fee: 5612640,
              more: menu("PLY-0031"),
            },
            {
              _key: "b",
              _checked: true,
              _changed: true,
              _href: "#",
              id: "PLY-0027",
              prem: "The Lintel Coffee – Lý Tự Trọng",
              st: { family: "info", label: "Mất kết nối, vẫn phát" },
              due: { due: "2026-10-01T17:00:00+07:00", now: now },
              wait: 87,
              fee: 1850000,
              more: menu("PLY-0027"),
            },
            {
              _key: "d",
              _disabled: true,
              _disabledReason: "Thiết bị đã báo mất nên không đưa vào thao tác hàng loạt.",
              id: "PLY-0009",
              prem: "Ô Cửa Tre Lounge – Phú Mỹ Hưng",
              st: { family: "danger", label: "Đã báo mất" },
              due: null,
              wait: 214,
              fee: null,
              more: menu("PLY-0009"),
            },
          ]}
          totals={{ values: { wait: 915, fee: 7462640 } }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "var(--space-6)",
            alignItems: "start",
          }}
        >
          <Table density="console" caption="Đang tải" loading={4} columns={cols.slice(0, 4)} rows={[]} />
          <Table
            density="console"
            caption="Không có dòng"
            columns={cols.slice(0, 4)}
            rows={[]}
            empty={{
              variant: "filtered",
              title: "Không có thiết bị nào mất kết nối quá 24 giờ.",
              text: "Bỏ bộ lọc “Quá 24 giờ” để xem mọi thiết bị mất kết nối.",
            }}
          />
        </div>
        <Table
          density="portal"
          caption="Thiết bị của cơ sở"
          expandable={true}
          columns={[
            { key: "id", label: "Thiết bị", kind: "id" },
            { key: "st", label: "Tình trạng", kind: "status" },
            { key: "seen", label: "Kết nối gần nhất", kind: "datetime" },
            { key: "sup", label: "Nhà cung cấp", priority: "low" },
            { key: "cert", label: "Chứng nhận đến", kind: "date", priority: "low" },
            { key: "who", label: "Người ghép", kind: "person", priority: "low" },
          ]}
          rows={[
            {
              _key: "x",
              _expanded: true,
              id: "PLY-0023",
              st: { family: "positive", label: "Đang hoạt động" },
              seen: "2026-09-28T10:12:00+07:00",
              sup: "Hạt Âm Devices",
              cert: "2027-03-31",
              who: { name: "Đỗ Thu Trang", detail: "Chủ cơ sở" },
            },
            {
              _key: "y",
              id: "PLY-0044",
              st: { family: "positive", label: "Đang hoạt động" },
              seen: "2026-09-28T10:08:00+07:00",
              sup: "Sóng Chín Audio",
              cert: "2027-06-30",
              who: { name: "Đỗ Thu Trang", detail: "Chủ cơ sở" },
            },
          ]}
          loadingMore={true}
        />
        <Table
          density="console"
          caption="Khoản chuyển trả quá hạn"
          columns={[
            { key: "id", label: "Khoản chuyển trả", kind: "id" },
            { key: "to", label: "Tổ chức nhận" },
            { key: "amt", label: "Số tiền", unit: "VND", kind: "money" },
            { key: "share", label: "Tỷ lệ", kind: "percent", decimals: 2 },
          ]}
          rows={[
            {
              _key: "r",
              id: "RMT-9MDV5RXK3T",
              to: "APPA",
              amt: 229000,
              share: 23.22,
              _message: {
                severity: "warning",
                text: "Khoản chuyển trả chưa được xác nhận trong thời hạn đã duyệt. Việc quá hạn vẫn được ghi lại kể cả khi ngân hàng xác nhận sau đó.",
                code: "FIN_REMITTANCE_PERIOD_BREACHED",
              },
            },
          ]}
        />
        <Table
          density="console"
          caption="Cơ sở trong đợt cấp giấy xác nhận"
          columns={[
            { key: "id", label: "Cơ sở", kind: "id" },
            { key: "name", label: "Tên cơ sở", minWidth: "var(--space-56)" },
            { key: "st", label: "Tình trạng", kind: "status" },
            { key: "fee", label: "Phí năm", unit: "VND", kind: "money" },
          ]}
          rows={[
            {
              _key: "p1",
              id: "PRM-4TQ8MX2KHD",
              name: "Then Cửa Bakery – Hai Bà Trưng",
              st: { family: "positive", label: "Đã cấp" },
              fee: 3290998,
            },
            {
              _key: "p2",
              id: "PRM-7RW3KD9QJM",
              name: "Khách sạn Nắng Xiên – Sơn Trà",
              st: {
                family: "danger",
                label: "Đã thu hồi",
                icon: "ban",
                identifier: "R1-CER-2026-W5HK8TQM",
                identifierLabel: "Giấy bị thu hồi",
              },
              fee: 12480000,
            },
            {
              _key: "p3",
              _dropped: true,
              _droppedReason:
                "Đã loại khỏi đợt này ngày " +
                format.date("2026-10-02") +
                ": cơ sở ngừng kinh doanh, theo xác nhận của chính quyền phường.",
              id: "PRM-2NB6XT4WCE",
              name: "Ô Cửa Tre Lounge – Phú Mỹ Hưng",
              st: { family: "neutral", label: "Ngoài phạm vi" },
              fee: 2916000,
            },
          ]}
        />
        <Table
          density="portal"
          caption="Mã đọc cho tổng đài"
          columns={[
            { key: "id", label: "Mã tham chiếu", kind: "id", size: "lg" },
            { key: "what", label: "Việc cần hỗ trợ" },
          ]}
          rows={[{ _key: "q", id: "SUP-8KD4QW7TXN", what: "Cơ sở hỏi về khoản phí năm 2027" }]}
        />
      </div>
    );
  },
};

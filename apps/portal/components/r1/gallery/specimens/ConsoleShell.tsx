"use client";

import { Button, ConsoleShell, FactList, FilterBar, PageHeader, SidePanel, Table, TextField, format } from "../..";
import type { TableProps } from "../..";
import type { Specimen } from "../specimen";

export const ConsoleShellSpecimen: Specimen = {
  name: "ConsoleShell",
  group: "Shells",
  height: 1060,
  render() {
    const rail = [
      { label: "Việc của tôi", icon: "inbox", count: 14 },
      { label: "Chấp nhận minh chứng", icon: "file-check", current: true },
      { label: "Toàn vẹn", icon: "shield-check" },
      { label: "Tạm giữ", icon: "archive", count: 3 },
      { label: "Chính sách", icon: "scale" },
    ];
    const keyMap = [
      { keys: ["J", "K"], label: "Chuyển giữa các dòng của bảng" },
      { keys: ["Enter"], label: "Mở dòng đang chọn" },
    ];
    const rows = [
      {
        _key: "a",
        _href: "#",
        id: "EVB-7KQ2M9TX4P",
        prem: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng",
        st: { family: "attention", label: "Tạm giữ" },
        n: 412,
      },
      {
        _key: "b",
        _href: "#",
        _selected: true,
        id: "EVB-3HN8WQ5D2R",
        prem: "The Lintel Coffee – Lý Tự Trọng",
        st: { family: "info", label: "Đã nhận" },
        n: 87,
      },
      {
        _key: "c",
        _href: "#",
        id: "EVB-9TD4KX7M1V",
        prem: "Áp Mái Bar – Thảo Điền",
        st: { family: "positive", label: "Đã chấp nhận" },
        n: 1206,
      },
    ];
    const cols: TableProps["columns"] = [
      { key: "id", label: "Lô minh chứng", kind: "id" },
      { key: "prem", label: "Cơ sở", minWidth: "var(--space-56)" },
      { key: "st", label: "Tình trạng", kind: "status" },
      { key: "n", label: "Số lượt", kind: "count" },
    ];
    function work() {
      return [
        <PageHeader key="h" title="Chấp nhận minh chứng" meta={"Kỳ " + format.period("2026-09-01", "2026-09-30")}>
          <Button size="sm" icon="plus" shortcut="Alt+N">
            Thêm ngoại lệ
          </Button>
        </PageHeader>,
        <FilterBar key="f" label="Lọc lô minh chứng" shortcut="/" summary="3 trong 46 lô">
          <TextField label="Cơ sở" density="console" placeholder="Tên hoặc mã cơ sở" width="var(--space-72)" />
        </FilterBar>,
        <div
          key="g"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) var(--container-sm)",
            gap: "var(--space-6)",
            alignItems: "start",
          }}
        >
          <Table density="console" caption="Lô minh chứng chờ xử lý" rowFocus={true} columns={cols} rows={rows} />
          <SidePanel
            title="EVB-3HN8WQ5D2R"
            eyebrow="Lô minh chứng"
            status={{ family: "info", label: "Đã nhận" }}
            onClose={false}
            actions={[{ label: "Chấp nhận lô" }, { label: "Tạm giữ" }]}
          >
            <FactList
              items={[
                { label: "Cơ sở", value: "The Lintel Coffee – Lý Tự Trọng" },
                { label: "Thiết bị", value: "PLY-0027", kind: "id" },
                { label: "Số lượt", value: 87, kind: "count" },
              ]}
            />
          </SidePanel>
        </div>,
      ];
    }
    return (
      <div className="pv">
        <div style={{ position: "relative", overflow: "hidden" }}>
          <ConsoleShell
            area="Minh chứng"
            queueCount={14}
            account="Lê Đăng Quý"
            rail={rail}
            keyMap={keyMap}
            onSearch={function () {}}
            signOut={{ href: "#" }}
          >
            {work()}
          </ConsoleShell>
        </div>
        <div style={{ position: "relative", overflow: "hidden", height: "calc(var(--space-96) + var(--space-56))" }}>
          <ConsoleShell
            area="Minh chứng"
            queueCount={14}
            account="Lê Đăng Quý"
            rail={rail}
            keyMap={keyMap}
            keysOpen={true}
            singleKeys="off"
            collapsed={true}
            onSearch={function () {}}
            style={{ height: "100%" }}
          >
            <FilterBar label="Lọc lô minh chứng" shortcut="/" summary="3 trong 46 lô">
              <TextField label="Cơ sở" density="console" placeholder="Tên hoặc mã cơ sở" width="var(--space-72)" />
            </FilterBar>
            <Table density="console" caption="Lô minh chứng chờ xử lý" rowFocus={true} columns={cols} rows={rows} />
          </ConsoleShell>
        </div>
      </div>
    );
  },
};

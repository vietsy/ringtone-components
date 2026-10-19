"use client";

import { Button, PageHeader, format } from "../..";
import type { Specimen } from "../specimen";

export const PageHeaderSpecimen: Specimen = {
  name: "PageHeader",
  group: "Page",
  height: 300,
  render() {
    return (
      <div className="pv" style={{ background: "var(--page)" }}>
        <PageHeader
          crumbs={[{ label: "Vận hành" }, { label: "Thiết bị Player", href: "#" }]}
          title="PLY-0009"
          status={{ family: "danger", label: "Đã báo mất" }}
          meta={
            "Tại Ô Cửa Tre Lounge – Phú Mỹ Hưng. Nhà cung cấp Hạt Âm Devices, định danh dev-8f21-44, đăng ký ngày " +
            format.date("2026-01-28") +
            "."
          }
        >
          <Button size="sm" variant="quiet" icon="download">
            Tải hồ sơ thiết bị về
          </Button>
        </PageHeader>
        <PageHeader
          crumbs={[{ label: "Vận hành" }, { label: "Thiết bị Player", href: "#" }]}
          title="PLY-0031 tại Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng"
          status={{ family: "info", label: "Mất kết nối, vẫn phát" }}
        >
          <Button
            size="sm"
            disabled={true}
            disabledReason={"Hãy quyết định xử lý " + format.count(614) + " minh chứng chưa đồng bộ trước."}
          >
            Chuyển thiết bị
          </Button>
          <Button size="sm" variant="quiet">
            Nhắc cơ sở
          </Button>
        </PageHeader>
      </div>
    );
  },
};

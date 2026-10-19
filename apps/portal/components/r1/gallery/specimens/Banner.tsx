"use client";

import { Banner, Button, format } from "../..";
import type { Specimen } from "../specimen";

export const BannerSpecimen: Specimen = {
  name: "Banner",
  group: "Feedback",
  height: 696,
  render() {
    return (
      <div className="pv" style={{ display: "grid", gap: "var(--space-3)" }}>
        <Banner family="attention" title="214 minh chứng đang tạm giữ" actions={[{ label: "Mở quyết định DSP-0098" }]}>
          {"IAM thu hồi định danh thiết bị lúc " +
            format.timestamp("2026-09-12T09:21:00+07:00") +
            ". Minh chứng từ " +
            format.timestamp("2026-09-10T14:00:00+07:00") +
            " trở đi nằm ngoài phân phối cho tới khi có quyết định DSP-0098."}
        </Banner>
        <Banner
          family="neutral"
          title="Chưa đăng ký: loại cơ sở này nằm ngoài giấy phép trực tiếp"
          code="PREMISES_CLASS_OUT_OF_SCOPE"
        >
          Giấy phép trực tiếp của RightOne không áp dụng cho loại cơ sở này nên cơ sở không dùng được dịch vụ Player.
          Phạm vi giấy phép và cách xin phép qua quy trình cấp phép chung có ngay bên dưới.
        </Banner>
        <Banner
          family="positive"
          title={"Đã đối soát xong kỳ " + format.period("2026-09-01", "2026-09-30")}
          onDismiss={function () {}}
        >
          46 thiết bị đã gửi đủ minh chứng.
        </Banner>
        <Banner family="info" compact={true}>
          Mất kết nối, nhạc vẫn phát. Còn 18 giờ 12 phút.
        </Banner>
        <Banner
          family="danger"
          title="Chưa ghi nhận được quyết định"
          code="NO_DISPOSITION_GROUND"
          actions={<Button size="sm">Viết căn cứ</Button>}
        >
          Giải toả hay loại trừ đều cần ghi căn cứ.
        </Banner>
        <Banner
          family="attention"
          title="Hồ sơ RPS-Q4NDT7WZ2K cần giấy phép kinh doanh"
          density="portal"
          actions={[{ label: "Bổ sung giấy phép", variant: "primary" }]}
          onDismiss={function () {}}
        >
          {"Hạn bổ sung " + format.date("2026-10-06") + "."}
        </Banner>
      </div>
    );
  },
};

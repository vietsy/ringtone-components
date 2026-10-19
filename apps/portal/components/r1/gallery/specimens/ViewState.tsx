"use client";

import { ViewState, format } from "../..";
import type { Specimen } from "../specimen";

export const ViewStateSpecimen: Specimen = {
  name: "ViewState",
  group: "Feedback",
  height: 600,
  render() {
    return (
      <div className="pv">
        <ViewState
          view="empty"
          empty={{
            variant: "governed",
            title: "Không có phát hiện toàn vẹn nào trong " + format.period("2026-09-01", "2026-09-14") + ".",
            text: "Đã kiểm tra 46 thiết bị. Không thiếu chuỗi nào, không có kỳ nào bị hở và không hồ sơ nào bị sửa.",
          }}
        />
        <ViewState
          view="error"
          errorTitle="Chưa tải được danh sách thiết bị."
          errorText="Dịch vụ thiết bị không trả lời. Thử lại, hoặc mở trang trạng thái dịch vụ để xem khi nào dịch vụ trở lại."
          errorAction={{ label: "Xem trạng thái dịch vụ", onClick: function () {} }}
          traceId="3c9e0b71a4d25f86"
        />
        <ViewState view="refused" />
      </div>
    );
  },
};

"use client";

import { Disclosure } from "../..";
import type { Specimen } from "../specimen";

export const DisclosureSpecimen: Specimen = {
  name: "Disclosure",
  group: "Page",
  height: 290,
  render() {
    return (
      <div className="pv" style={{ maxWidth: "var(--container-2xl)", gap: 0 }}>
        <Disclosure title="Giấy xác nhận khác gì quyền sử dụng dịch vụ Player?" open={true}>
          <p>
            Giấy xác nhận cho biết cơ sở đã hoàn thành nghĩa vụ bản quyền trong kỳ. Quyền sử dụng dịch vụ Player cho
            biết cơ sở được dùng Player.
          </p>
        </Disclosure>
        <Disclosure title="Mã QR trên giấy xác nhận dùng để làm gì?">
          <p>Ai cũng quét được mã để xem giấy xác nhận còn hiệu lực hay không, không cần tài khoản.</p>
        </Disclosure>
        <Disclosure title="Quét mã mà trang báo không tìm thấy mã thì làm gì?" meta="2 bước">
          <p>
            Kiểm tra lại mã in bên cạnh mã QR. Nếu mã đúng mà vẫn không có kết quả, gửi phản ánh kèm ảnh giấy xác nhận.
          </p>
        </Disclosure>
      </div>
    );
  },
};

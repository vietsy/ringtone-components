"use client";

import { ItemList } from "../..";
import type { Specimen } from "../specimen";

export const ItemListSpecimen: Specimen = {
  name: "ItemList",
  group: "Data",
  height: 420,
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
        <ItemList
          label="Bài trong danh sách"
          reorder={true}
          items={[
            { title: "Về đi, trời mưa rồi", detail: "Na Bích" },
            { title: "Nhắn muộn một chút", detail: "Rinh" },
            { title: "Cứ thong thả thôi", detail: "Ngân Mộc" },
          ]}
        />
        <ItemList
          label="Tiêu chí qua cổng"
          density="console"
          items={[
            { family: "positive", title: "Uỷ quyền của cổng có hiệu lực" },
            {
              family: "danger",
              title: "Đủ người giữ các vai trò bắt buộc",
              detail: "Chưa bổ nhiệm chủ sở hữu biểu phí",
            },
            { family: "attention", title: "Ngưỡng tách nhiệm dùng mặc định an toàn" },
          ]}
        />
        <ItemList
          label="Cơ sở trong chuỗi"
          density="portal"
          items={[
            {
              title: "Then Cửa Bakery – Hai Bà Trưng",
              detail: "86 m², quán bánh",
              actions: [{ label: "Gỡ", ariaLabel: "Gỡ Then Cửa Bakery – Hai Bà Trưng khỏi chuỗi" }],
            },
            {
              title: "Then Cửa Coffee & Tea – Pasteur",
              detail: "96 m², quán cà phê",
              actions: [{ label: "Gỡ", ariaLabel: "Gỡ Then Cửa Coffee & Tea – Pasteur khỏi chuỗi" }],
            },
          ]}
        />
      </div>
    );
  },
};

"use client";

import { FileList } from "../..";
import type { Specimen } from "../specimen";

export const FileListSpecimen: Specimen = {
  name: "FileList",
  group: "Data",
  height: 488,
  render() {
    return (
      <div className="pv" style={{ maxWidth: "var(--container-2xl)" }}>
        <FileList
          label="Giấy tờ kèm hồ sơ"
          items={[
            {
              name: "giay-phep-kinh-doanh-then-cua-pasteur.pdf",
              type: "pdf",
              size: "1,2 MB",
              at: "2026-09-28T10:02:00+07:00",
              by: "Đỗ Thu Trang",
              href: "#",
              removable: true,
            },
            {
              name: "anh-mat-tien-quan.jpg",
              type: "image",
              size: "3,4 MB",
              at: "2026-09-28T10:03:00+07:00",
              by: "Đỗ Thu Trang",
              state: "scanning",
            },
            {
              name: "hop-dong-thue-mat-bang.docm",
              type: "other",
              size: "640 KB",
              at: "2026-09-28T10:04:00+07:00",
              by: "Đỗ Thu Trang",
              state: "quarantined",
              reason: "Tệp có macro nên bị cách ly. Gửi lại dưới dạng PDF.",
              removable: true,
            },
            {
              name: "bien-lai-nop-phi-quy-3.pdf",
              type: "pdf",
              size: "2,1 MB",
              by: "Đỗ Thu Trang",
              state: "uploading",
              progress: 45,
              onCancel: function () {},
            },
            {
              name: "so-do-mat-bang.pdf",
              type: "pdf",
              size: "18,4 MB",
              at: "2026-09-28T10:06:00+07:00",
              by: "Đỗ Thu Trang",
              state: "failed",
              reason: "Mất kết nối khi đã tải được 12 MB. Tải lên lại; tệp vẫn ở trên máy.",
              onRetry: function () {},
              removable: true,
            },
          ]}
        />
      </div>
    );
  },
};

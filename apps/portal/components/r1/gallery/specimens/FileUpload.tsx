"use client";

import { FileUpload } from "../..";
import type { Specimen } from "../specimen";

export const FileUploadSpecimen: Specimen = {
  name: "FileUpload",
  group: "Flows",
  height: 664,
  render() {
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <FileUpload label="Tệp âm thanh" helper="WAV hoặc FLAC, tối đa 200 MB." />
        <FileUpload label="Tệp âm thanh" helper="WAV hoặc FLAC, tối đa 200 MB." state="dragover" />
        <FileUpload
          label="Tệp âm thanh"
          helper="WAV hoặc FLAC, tối đa 200 MB."
          error="Tệp này là MP3. Chọn tệp WAV hoặc FLAC, tối đa 200 MB."
        />
        <FileUpload
          label="Tệp âm thanh"
          helper="WAV hoặc FLAC, tối đa 200 MB."
          disabled={true}
          disabledReason="Bản ghi này đang được rà soát nên chưa thay tệp được."
        />
        <FileUpload
          label="Tệp âm thanh"
          fileName="de-anh-noi-not_master.wav"
          fileSize="48,2 MB"
          onFiles={function () {}}
          onRemove={function () {}}
          stages={[
            { label: "Tải lên", state: "done" },
            { label: "Xử lý âm thanh", state: "done" },
            { label: "Kiểm tra kỹ thuật", state: "current", detail: "Còn khoảng 4 phút" },
            { label: "Rà soát trùng khớp" },
            { label: "Kết quả rà soát" },
          ]}
        />
      </div>
    );
  },
};

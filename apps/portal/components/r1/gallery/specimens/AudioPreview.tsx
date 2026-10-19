"use client";

import { AudioPreview } from "../..";
import type { Specimen } from "../specimen";

export const AudioPreviewSpecimen: Specimen = {
  name: "AudioPreview",
  group: "Media",
  height: 224,
  render() {
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <AudioPreview
          title="Hẹn thứ Bảy"
          by="Vy Sa"
          duration={238}
          elapsed={42}
          clip="Đoạn nghe thử 30 giây, từ 0:30"
        />
        <AudioPreview title="Chín giờ tan ca" by="Rinh" duration={201} elapsed={118} playing={true} />
        <AudioPreview title="Khẽ thôi, phố ngủ rồi" by="Ngân Mộc" unavailable={true} />
        <AudioPreview title="Nhắn muộn một chút" by="Rinh" duration={186} error={true} />
      </div>
    );
  },
};

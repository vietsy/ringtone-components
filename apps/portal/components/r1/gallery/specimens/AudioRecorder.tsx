"use client";

import { AudioRecorder } from "../..";
import type { Specimen } from "../specimen";

export const AudioRecorderSpecimen: Specimen = {
  name: "AudioRecorder",
  group: "Operations",
  height: 360,
  render() {
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <AudioRecorder
          state="idle"
          max={30}
          note="Ghi tối đa 30 giây để đối chiếu bài đang phát. Bản ghi được giữ và xoá theo cùng quy định với dữ liệu đo."
        />
        <AudioRecorder
          state="recording"
          elapsed={12}
          max={30}
          levels={[0.2, 0.5, 0.7, 0.4, 0.8, 0.6, 0.3, 0.5, 0.9, 0.7, 0.4, 0.6, 0.8, 0.5, 0.3, 0.6, 0.7, 0.5, 0.4, 0.6]}
        />
        <AudioRecorder
          state="recorded"
          elapsed={30}
          max={30}
          levels={[0.3, 0.5, 0.6, 0.4, 0.7, 0.5, 0.3, 0.4, 0.8, 0.6, 0.4, 0.5, 0.7, 0.4, 0.3, 0.5, 0.6, 0.4, 0.3, 0.5]}
        />
        <AudioRecorder state="denied" max={30} />
      </div>
    );
  },
};

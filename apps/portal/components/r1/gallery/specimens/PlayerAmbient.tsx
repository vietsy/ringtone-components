"use client";

import { PlayerAmbient } from "../..";
import type { Tone } from "../../lib/types";
import type { Specimen } from "../specimen";

export const PlayerAmbientSpecimen: Specimen = {
  name: "PlayerAmbient",
  group: "Player",
  height: 300,
  render() {
    function stage(title: string, tone: Tone, by: string) {
      return (
        <div data-theme="player" className={"stage r1-toned r1-tone--" + tone + " r1-guest--ambient"}>
          <PlayerAmbient title={title} />
          <div className="pane r1-glass">
            <p>{title}</p>
            <p className="sub">{by}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="row">
        {stage("Để anh nói nốt", "teal", "Vy Sa ft. Duy Khê")}
        {stage("Bossa cho buổi trưa", "blue", "Hạt Tiêu Trio")}
      </div>
    );
  },
};

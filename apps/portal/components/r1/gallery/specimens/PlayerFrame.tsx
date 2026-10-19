"use client";

import type * as React from "react";
import { Artwork, Button, Clock, NowPlaying, PlayerAlert, PlayerControls, PlayerFacts, PlayerFrame, UpNext, WaveBar } from "../..";
import type { PlayerFrameProps } from "../..";
import type { Specimen } from "../specimen";

export const PlayerFrameSpecimen: Specimen = {
  name: "PlayerFrame",
  group: "Player",
  height: 1320,
  render() {
    const at = function (hm: string) {
      return new Date("2026-09-28T" + hm + ":00+07:00");
    };
    const title = "Để anh nói nốt";
    const rail: NonNullable<PlayerFrameProps["rail"]> = {
      premises: "Then Cửa Coffee & Tea – Pasteur",
      place: "Phường Bến Thành, TP. Hồ Chí Minh",
      condition: "online",
      detail: [
        { text: "Đồng bộ lúc {at:time}", at: at("12:24") },
        { text: "{n} minh chứng chờ gửi", n: 0 },
      ],
      device: "PLY-0023",
      facts: [{ text: "{n} / {total} bài sẵn sàng", n: 286, total: 286 }],
      storage: { value: 11, max: 32 },
      href: "#",
    };
    // The face of a playing Player: the cover and the credits, the deck, the clock and what plays next. The frame's
    // size and orientation set every size inside it.
    const playing = function (cover: number) {
      return (
        <div className="r1-pframe__cols">
          <div className="r1-pframe__centre r1-pframe__centre--deck">
            <NowPlaying
              scale="device"
              layout="cover"
              title={title}
              byline="Vy Sa ft. Duy Khê"
              credits={{
                composer: "Võ Duy Khê",
                lyricist: "Võ Duy Khê, Vy Sa",
                performer: "Vy Sa, Duy Khê",
                producer: "Lầu 3 Studio",
              }}
              locale="vi"
            >
              <Artwork variant="groove" title={title} size={cover} locale="vi" />
            </NowPlaying>
            <div className="r1-pframe__deck">
              <WaveBar elapsed={84} duration={276} title={title} locale="vi" />
              <PlayerControls transport={true} progress={false} elapsed={84} duration={276} volume={60} locale="vi" />
            </div>
          </div>
          <div className="r1-pframe__rule" />
          <div className="r1-pframe__side">
            <Clock time={at("12:28")} locale="vi" />
            <UpNext
              schedule="Lịch “Giờ trưa”"
              start={at("11:00")}
              end={at("14:00")}
              left={92 * 60000}
              locale="vi"
              next={[
                { time: at("12:31"), title: "Bossa cho buổi trưa", performer: "Hạt Tiêu Trio" },
                { time: at("12:35"), title: "Về đi, trời mưa rồi", performer: "Na Bích" },
                { time: at("12:39"), title: "Chủ nhật lười", performer: "Xe Đạp Điện" },
              ]}
            />
          </div>
        </div>
      );
    };
    // A frame drawn at a fraction of its size, in a box that takes only the room the scaled frame needs.
    const scaled = function (width: string, height: string, zoom: number, frame: React.ReactElement) {
      return (
        <div style={{ width: "calc(" + width + " * " + zoom + ")", height: "calc(" + height + " * " + zoom + ")" }}>
          <div style={{ zoom }}>{frame}</div>
        </div>
      );
    };
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "flex-start" }}>
        {scaled(
          "var(--player-width)",
          "var(--player-height)",
          0.5,
          <PlayerFrame size="md" track={title} locale="vi" rail={rail}>
            {playing(320)}
          </PlayerFrame>,
        )}
        {/* Figma PlayerFrame/sm, 390 x 844: the phone upright. */}
        {scaled(
          "var(--player-width-phone)",
          "var(--player-height-phone)",
          0.5,
          <PlayerFrame size="sm" orient="portrait" track={title} locale="vi" rail={rail}>
            {playing(160)}
          </PlayerFrame>,
        )}
        {/* The phone on its side, 844 x 390: the library draws it as PlayerFrame/sm landscape. */}
        {scaled(
          "var(--player-width-phone-landscape)",
          "var(--player-height-phone-landscape)",
          0.5,
          <PlayerFrame size="sm" orient="landscape" track={title} locale="vi" rail={rail}>
            {playing(160)}
          </PlayerFrame>,
        )}
        {/* Figma PlayerFrame/lg cannot continue, 1920 x 1080: the staff screen with nothing it may play. */}
        {scaled(
          "var(--player-width-lg)",
          "var(--player-height-lg)",
          0.4,
          <PlayerFrame size="lg" locale="vi" rail={{ ...rail, condition: "cannot-continue", detail: [{ text: "Đồng bộ lúc {at:time}", at: at("18:55") }] }}>
            <div className="r1-pframe__cols">
              <div className="r1-pframe__centre">
                <PlayerAlert
                  condition="cannot-continue"
                  when={at("18:55")}
                  title="Không có bài nào phát được"
                  why="Mọi bài trên máy đã hết quyền phát cho cơ sở này."
                  action="Chủ cơ sở cập nhật danh sách phát trong cổng cơ sở."
                  locale="vi"
                >
                  <Button variant="primary" size="xl" icon="refresh-cw" locale="vi">
                    Đồng bộ lại
                  </Button>
                </PlayerAlert>
              </div>
              <div className="r1-pframe__rule" />
              <div className="r1-pframe__side">
                <Clock time={at("18:58")} locale="vi" />
                <PlayerFacts
                  title="Cho bộ phận hỗ trợ"
                  locale="vi"
                  items={[
                    { label: "Mã tham chiếu", value: "5c1e 08ad", code: true },
                    { label: "Minh chứng chờ gửi", value: 786 },
                    { label: "Kết nối lần cuối", value: at("18:55") },
                  ]}
                />
              </div>
            </div>
          </PlayerFrame>,
        )}
      </div>
    );
  },
};

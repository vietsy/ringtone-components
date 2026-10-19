"use client";

import { Artwork } from "../..";
import type { Specimen } from "../specimen";

export const ArtworkSpecimen: Specimen = {
  name: "Artwork",
  group: "Player",
  height: 400,
  render() {
    // A stand-in catalogue image (drawn here, no network): a square in the accent with a disc in the accent surface,
    // both read from the semantic tokens. And one that fails to load.
    const tk = getComputedStyle(document.documentElement);
    const img =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="' +
          tk.getPropertyValue("--accent").trim() +
          '"/><circle cx="5" cy="5" r="3" fill="' +
          tk.getPropertyValue("--accent-surface").trim() +
          '"/></svg>',
      );
    return (
      <div
        data-theme="player"
        style={{
          background: "var(--page)",
          color: "var(--on-surface)",
          padding: "var(--space-6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-6)",
          alignItems: "flex-start",
        }}
      >
        <Artwork title="Hẹn thứ Bảy" by="Vy Sa" size={160} locale="vi" />
        <Artwork title="Hẹn thứ Bảy" by="Vy Sa" size={160} state="paused" locale="vi" />
        <Artwork variant="groove" title="Để anh nói nốt" size={160} locale="vi" />
        {/* Figma's Tone: the same title in the tone a screen sets, over the one its title would pick. */}
        <Artwork variant="groove" title="Để anh nói nốt" size={160} tone="blue" locale="vi" />
        <Artwork title="Hẹn thứ Bảy" by="Vy Sa" size={160} tone="teal" locale="vi" />
        <Artwork title="Hẹn thứ Bảy" by="Vy Sa" size={160} tone="blue" locale="vi" />
        <Artwork src={img} alt="Bìa đĩa Để anh nói nốt" size={160} state="paused" locale="vi" />
        <Artwork src="data:image/png;base64,AAAA" alt="Bìa đĩa" size={160} locale="vi" />
        <Artwork state="paused" size={160} locale="vi" />
      </div>
    );
  },
};

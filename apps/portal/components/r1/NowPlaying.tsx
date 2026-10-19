"use client";

import type * as React from "react";
import { createElement } from "react";
import { StatusIcon } from "./StatusIcon";
import { cx } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

// Four static bars: says "playing" by shape. Static on purpose: the Player runs on old hardware.
function PlayingGlyph(p: { paused?: boolean | undefined }) {
  const paused = p && p.paused;
  const bars = paused
    ? [
        [5, 3, 18],
        [13, 3, 18],
      ]
    : [
        [1, 9, 15],
        [7, 2, 22],
        [13, 12, 12],
        [19, 6, 18],
      ];
  return (
    <svg className="r1-now__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {bars.map(function (b, i) {
        return (
          <rect
            key={i}
            x={b[0]}
            y={b[1]}
            width={paused ? 6 : 4}
            height={b[2]}
            rx={1.5}
            style={{ fill: "var(--on-surface-muted)" }}
          />
        );
      })}
    </svg>
  );
}

export type NowPlayingProps = {
  title: string;
  eyebrow?: string | undefined;
  byline?: string | undefined;
  credits: {
    composer?: string | undefined;
    lyricist?: string | undefined;
    performer?: string | undefined;
    producer?: string | undefined;
  };
  optional?: { label: string; state: "available" | "unavailable" }[] | undefined;
  note?: string | undefined;
  /** display: the guest display, read at 3 m (the default); device: the Player's centre column; phone: the guest's own
   * phone; compact: Figma's Scale=Compact, 358 px wide, the cover (children) and the four credits side by side above the
   * eyebrow, the title and the byline, at phone sizes on the Player's ground */ scale?:
    "display" | "device" | "phone" | "compact" | undefined;
  layout?: "poster" | "cover" | undefined;
  paused?: boolean | undefined;
  level?: 1 | 2 | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

export function NowPlaying(p: NowPlayingProps) {
  const t = tx(p.locale);
  const c: NowPlayingProps["credits"] = p.credits || {};
  const scale = p.scale || "display";
  const roles: [keyof NowPlayingProps["credits"], string][] = [
    ["composer", t.now.composer],
    ["lyricist", t.now.lyricist],
    ["performer", t.now.performer],
    ["producer", t.now.producer],
  ];
  const optional = p.optional || [];
  const anyDown = optional.some(function (o) {
    return o.state === "unavailable";
  });
  return (
    <section
      className={cx(
        "r1-now",
        "r1-now--" + scale,
        p.layout === "poster" && "r1-now--poster",
        p.layout === "cover" && "r1-now--cover",
        p.className,
      )}
      data-theme={scale === "display" ? "player" : undefined}
      aria-live="polite"
      style={p.style}
    >
      <p className="r1-now__eyebrow">
        <PlayingGlyph paused={p.paused} />
        <span>{p.eyebrow || (p.paused ? t.deck.paused : t.now.nowPlaying)}</span>
      </p>
      {createElement(p.level === 1 ? "h1" : "h2", { className: "r1-now__title" }, p.title)}
      {p.byline ? <p className="r1-now__byline">{p.byline}</p> : null}
      {(function () {
        const dl = (
          <dl className="r1-now__credits">
            {roles.map(function (r) {
              // A role with no one in it (an instrumental has no lyricist) is a dash on screen and "none" to a screen reader.
              const v = c[r[0]];
              const who =
                typeof v === "string" && v.indexOf(", ") > 0
                  ? v.split(", ").map(function (x, j) {
                      return (
                        <span key={j} className="r1-now__person">
                          {x}
                        </span>
                      );
                    })
                  : v
                    ? v
                    : [
                        <span key="d" aria-hidden="true">
                          –
                        </span>,
                        <span key="s" className="r1-sr">
                          {t.now.none}
                        </span>,
                      ];
              return (
                <div key={r[0]} className="r1-now__credit">
                  <dt>{r[1]}</dt>
                  <dd>{who}</dd>
                </div>
              );
            })}
          </dl>
        );
        return p.children ? (
          <div className="r1-now__pair">
            {dl}
            <div className="r1-now__aside">{p.children}</div>
          </div>
        ) : (
          dl
        );
      })()}
      {optional.length ? (
        <div className="r1-now__optional">
          <ul>
            {optional.map(function (o, i) {
              return (
                <li key={i} className={"r1-now__opt r1-now__opt--" + o.state}>
                  <StatusIcon
                    family={o.state === "available" ? "positive" : "neutral"}
                    size={scale === "display" ? 32 : 16}
                    cutout="page"
                  />
                  <span>
                    {o.label}
                    {o.state === "available"
                      ? null
                      : [
                          " ",
                          <span key="s" className="r1-now__opt-state">
                            {t.now.unavailable}
                          </span>,
                        ]}
                  </span>
                </li>
              );
            })}
          </ul>
          {anyDown && p.note ? <p className="r1-now__note">{p.note}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

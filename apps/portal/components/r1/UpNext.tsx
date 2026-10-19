"use client";

import type * as React from "react";
import { formatCount } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { playerValue } from "./lib/player";
import { tx } from "./lib/strings";
import { formatDuration } from "./lib/time-limits";
import type { Locale, PlayerValue } from "./lib/types";

export type UpNextProps = {
  schedule?: string | undefined;
  summary?: string | undefined;
  start?: PlayerValue | undefined;
  end?: PlayerValue | undefined;
  left?: number | undefined;
  next?: { time: PlayerValue; title: string; performer?: string | undefined }[] | undefined;
  /** later tracks show their time and title only */ later?: { time: PlayerValue; title: string }[] | undefined;
  more?: string | undefined;
  moreCount?: number | undefined;
  moreUntil?: PlayerValue | undefined;
  nextLabel?: string | undefined;
  empty?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// What plays next. Times may be Dates or timestamps; the summary and the "more" line can be built from values.
export function UpNext(p: UpNextProps) {
  const t = tx(p.locale);
  const next = p.next || [],
    later = p.later || [];
  function hm(v: PlayerValue | undefined) {
    return playerValue(v, p.locale, "time");
  }
  // start and end, not from and to: an x-import on the canvas reserves `from` for a module address.
  // hm gives a PlayerValue back as a string, a number or a Date, never an element.
  const summary = !isNil(p.summary)
    ? p.summary
    : !isNil(p.start) && !isNil(p.end)
      ? String(hm(p.start) as PlayerValue) +
        "–" +
        String(hm(p.end) as PlayerValue) +
        (isNil(p.left) ? "" : ", " + t.deck.leftIn.replace("{d}", formatDuration(p.left, p.locale)))
      : null;
  const more = !isNil(p.more)
    ? p.more
    : !isNil(p.moreCount)
      ? (isNil(p.moreUntil) ? t.deck.moreAll : t.deck.more)
          .replace("{n}", String(formatCount(p.moreCount, p.locale)))
          .replace("{until}", String(hm(p.moreUntil) as PlayerValue | undefined))
      : null;
  function track(it: { title: string; performer?: string | undefined }) {
    return (
      <span className="r1-upnext__track">
        <span className="r1-upnext__title">{it.title}</span>
        {it.performer ? <span className="r1-upnext__by">{it.performer}</span> : null}
      </span>
    );
  }
  return (
    <section className={cx("r1-upnext", p.className)} style={p.style} aria-label={p.schedule || t.deck.schedule}>
      {p.schedule || summary ? (
        <header className="r1-upnext__head">
          {p.schedule ? <h2 className="r1-upnext__schedule">{p.schedule}</h2> : null}
          {summary ? <p className="r1-upnext__summary">{summary}</p> : null}
        </header>
      ) : null}
      {next.length ? (
        <div className="r1-upnext__group">
          <h3 className="r1-upnext__label">{p.nextLabel || t.deck.upNext}</h3>
          <ol className="r1-upnext__list">
            {next.map(function (it, i) {
              return (
                <li key={i} className={cx("r1-upnext__item", i === 0 && "r1-upnext__item--first")}>
                  <span className="r1-upnext__time r1-num">{hm(it.time)}</span>
                  {track(it)}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
      {later.length ? (
        <div className="r1-upnext__group r1-upnext__group--later">
          <h3 className="r1-upnext__label">{t.deck.later}</h3>
          <ol className="r1-upnext__list r1-upnext__list--compact">
            {later.map(function (it, i) {
              return (
                <li key={i} className="r1-upnext__item">
                  <span className="r1-upnext__time r1-num">{hm(it.time)}</span>
                  <span className="r1-upnext__track">
                    <span className="r1-upnext__title">{it.title}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {more ? <p className="r1-upnext__more">{more}</p> : null}
        </div>
      ) : null}
      {
        // Nothing scheduled after this track: the column says so rather than going blank.
        !next.length && !later.length ? <p className="r1-upnext__empty">{p.empty || t.deck.nothingNext}</p> : null
      }
    </section>
  );
}

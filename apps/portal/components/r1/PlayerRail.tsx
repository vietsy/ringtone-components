"use client";

import type * as React from "react";
import { useEffect } from "react";
import { Clock } from "./Clock";
import { Icon } from "./Icon";
import { Meter } from "./Meter";
import { StatusIcon } from "./StatusIcon";
import { cx, isControl, isNil, useLatest } from "./lib/helpers";
import { PLAYER_FAMILY, hoursText, playerLine } from "./lib/player";
import { RAIL_FAMILIES } from "./lib/player-parts";
import { tx } from "./lib/strings";
import type { Family, PlayerCondition, RailProps } from "./lib/types";

export type PlayerRailProps = RailProps & {
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The left column of the landscape Player: where, what state, what the device holds. Always visible.
// condition names the state the way PlayerStatusBlock and PlayerAlert do, and sets the family and the word;
// a family outside the five falls back to neutral rather than painting a state it does not have.
export function PlayerRail(p: PlayerRailProps) {
  const t = tx(p.locale);
  const cond = PLAYER_FAMILY[p.condition as PlayerCondition] ? p.condition : null;
  const family: Family = cond
    ? PLAYER_FAMILY[cond]
    : RAIL_FAMILIES[p.family as Family]
      ? p.family!
      : p.family
        ? "neutral"
        : "positive";
  const state = isNil(p.state) && cond ? t.deck.states[cond] : p.state;
  // Shortcuts belong to the staff screen, the only size with a keyboard; a tablet or a phone lists none.
  const keyboard = !p.size || p.size === "lg";
  const latest = useLatest(p);
  // When nothing plays the rail is all there is: it binds the one key it lists, F for full screen.
  const bindF = keyboard && p.shortcuts === "stopped" && !!p.onFullscreen;
  useEffect(
    function () {
      if (!bindF) return undefined;
      function onKey(e: KeyboardEvent): void {
        if (e.ctrlKey || e.metaKey || e.altKey || isControl(e.target)) return;
        if ((e.key === "f" || e.key === "F") && latest.current.onFullscreen) latest.current.onFullscreen();
      }
      document.addEventListener("keydown", onKey);
      return function () {
        document.removeEventListener("keydown", onKey);
      };
    },
    [bindF],
  );
  const keys = !keyboard
    ? null
    : p.shortcuts === true
      ? [
          { keys: ["Space"], label: t.deck.keyPause },
          { keys: ["↑", "↓"], label: t.deck.keyVolume },
          { keys: ["N"], label: t.deck.keyNext },
          { keys: ["F"], label: t.deck.keyFull },
        ]
      : p.shortcuts === "stopped"
        ? [{ keys: ["F"], label: t.deck.keyFull }]
        : Array.isArray(p.shortcuts)
          ? p.shortcuts
          : null;
  // The offline countdown in hours; without a caption the rail writes the time left in words.
  const m = p.meter;
  const caption = m ? (isNil(m.caption) ? hoursText(m.value, p.locale) : m.caption) : null;
  const sub = m
    ? isNil(m.caption) && isNil(m.sub)
      ? t.deck.leftOf.replace("{max}", hoursText(m.max, p.locale))
      : m.sub
    : null;
  return (
    <aside className={cx("r1-rail", p.className)} style={p.style}>
      <p className="r1-rail__brand">
        <span>RightOne</span>
        <span className="r1-rail__product">Player</span>
      </p>
      {!isNil(p.time) ? (
        <div className="r1-rail__clock">
          <Clock time={p.time} day={p.day} locale={p.locale} />
        </div>
      ) : null}
      <div className="r1-rail__block r1-rail__where">
        <p className="r1-rail__premises">
          {(function (n) {
            const k = n.indexOf(" – ");
            return k < 0
              ? n
              : [
                  <span key="b" className="r1-rail__brandname">
                    {n.slice(0, k)}
                  </span>,
                  <span key="r" className="r1-rail__branch">
                    {n.slice(k + 3)}
                  </span>,
                ];
          })(p.premises || "RightOne Player")}
        </p>
        {p.place ? (
          <p className="r1-rail__place">
            {p.place.indexOf(", ") > 0
              ? p.place.split(", ").map(function (x, j) {
                  return (
                    <span key={j} className="r1-rail__placeline">
                      {x}
                    </span>
                  );
                })
              : p.place}
          </p>
        ) : null}
      </div>
      <div className="r1-rail__block r1-rail__status" role="status">
        <p className={"r1-rail__state r1-rail__state--" + family}>
          <StatusIcon family={family} size={24} cutout="surface" />
          <span>{state}</span>
        </p>
        {(p.detail || []).map(function (d, i) {
          return (
            <p key={i} className="r1-rail__line">
              {playerLine(d, p.locale)}
            </p>
          );
        })}
        {m ? (
          <div className="r1-rail__meter">
            <Meter value={m.value} max={m.max} family={m.family || family} label={m.label || t.deck.offlineLeft} />
            <p className="r1-rail__meterline">
              <strong className="r1-num">{caption}</strong>
              {sub ? " " + sub : null}
            </p>
            {m.note ? <p className="r1-rail__line">{m.note}</p> : null}
          </div>
        ) : null}
      </div>
      {p.device ? (
        <div className="r1-rail__block r1-rail__device">
          <p className="r1-rail__label">
            <span>{t.deck.player}</span>
            <span className="r1-mono">{p.device}</span>
          </p>
          {(p.facts || []).map(function (d, i) {
            return (
              <p key={i} className="r1-rail__line r1-num">
                {playerLine(d, p.locale)}
              </p>
            );
          })}
          {p.storage ? (
            <Meter
              value={p.storage.value}
              max={p.storage.max}
              family={p.storage.family || "accent"}
              label={p.storage.label || t.deck.storage}
            />
          ) : null}
        </div>
      ) : null}
      {keys ? (
        <div className="r1-rail__block r1-rail__keys">
          <p className="r1-rail__label">
            <span>{t.deck.shortcuts}</span>
          </p>
          <dl>
            {keys.map(function (k, i) {
              return (
                <div key={i} className="r1-rail__key">
                  <dt>
                    {k.keys.map(function (x, j) {
                      return <kbd key={j}>{x}</kbd>;
                    })}
                  </dt>
                  <dd>{k.label}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}
      {p.href ? (
        <a className="r1-rail__link" href={p.href}>
          <span>{p.linkLabel || t.deck.sync}</span>
          <Icon name="chevron-right" size={24} />
        </a>
      ) : null}
    </aside>
  );
}

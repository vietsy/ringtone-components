"use client";

import type * as React from "react";
import { Button } from "./Button";
import { StatusIcon } from "./StatusIcon";
import { cx, isNil } from "./lib/helpers";
import { PLAYER_FAMILY, hoursText, playerValue } from "./lib/player";
import { tx } from "./lib/strings";
import type { Strings } from "./lib/strings";
import type { Locale, PlayerValue } from "./lib/types";

const PLAYER_HEADLINE: Record<PlayerStatusBlockProps["condition"], keyof Strings["player"]> = {
  online: "online",
  offline: "offline",
  "limit-reached": "limit",
  stopped: "stopped",
  "cannot-continue": "cannot",
  ceiling: "ceiling",
};

export type PlayerStatusBlockProps = {
  condition: "online" | "offline" | "limit-reached" | "stopped" | "cannot-continue" | "ceiling";
  headline?: string | undefined;
  subject?: string | undefined;
  remaining?:
    | { value: number; total?: number | undefined; label?: string | undefined; totalLabel?: string | undefined }
    | undefined;
  facts?: { label: string; value: React.ReactNode | PlayerValue }[] | undefined;
  action?:
    | { label: string; icon?: string | undefined; href?: string | undefined; onClick?: (() => void) | undefined }
    | undefined;
  surface?: "portal" | "player" | undefined;
  size?: "compact" | "device" | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function PlayerStatusBlock(p: PlayerStatusBlockProps) {
  const t = tx(p.locale);
  const cond = p.condition || "online";
  const family = PLAYER_FAMILY[cond] || "info";
  const headline = p.headline || t.player[PLAYER_HEADLINE[cond] || "stopped"];
  const size = p.size || "compact";
  const rem = p.remaining;
  const pct = rem && rem.total ? Math.max(0, Math.min(100, Math.round((rem.value / rem.total) * 100))) : null;
  // remaining is in hours: without a label the component says the time left in words, in the reader's language.
  const remLabel = rem ? (isNil(rem.label) ? hoursText(rem.value, p.locale) : rem.label) : null;
  const remTotal = rem ? (isNil(rem.totalLabel) && rem.total ? hoursText(rem.total, p.locale) : rem.totalLabel) : null;
  return (
    <section
      className={cx("r1-player", "r1-player--" + cond, "r1-player--" + size, p.className)}
      data-theme={p.surface === "player" ? "player" : undefined}
      role={family === "danger" ? "alert" : "status"}
      style={p.style}
    >
      <div className="r1-player__head">
        <StatusIcon family={family} size={size === "device" ? 44 : 28} cutout="surface" />
        <div>
          <p className="r1-player__headline">{headline}</p>
          {p.subject ? <p className="r1-player__subject">{p.subject}</p> : null}
        </div>
      </div>
      {rem ? (
        <div className="r1-player__remain">
          <p className="r1-player__big r1-num">{remLabel}</p>
          <p className="r1-player__of">{t.player.left + (remTotal ? " " + t.player.of + " " + remTotal : "")}</p>
          {pct === null ? null : (
            <div
              className={"r1-meter r1-meter--" + family}
              role="meter"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={remLabel + " " + t.player.left}
              aria-label={headline}
            >
              <span className="r1-meter__fill" style={{ width: pct + "%" }} />
            </div>
          )}
        </div>
      ) : null}
      {p.children ? <div className="r1-player__detail">{p.children}</div> : null}
      {p.facts ? (
        <dl className="r1-player__facts">
          {p.facts.map(function (f, i) {
            return (
              <div key={i}>
                <dt>{f.label}</dt>
                <dd className="r1-num">{playerValue(f.value, p.locale)}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      {p.action ? (
        <div className="r1-player__action">
          <Button
            variant={family === "danger" ? "primary" : "secondary"}
            size={size === "device" ? "xl" : "lg"}
            icon={p.action.icon}
            href={p.action.href}
            onClick={p.action.onClick}
            locale={p.locale}
          >
            {p.action.label}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

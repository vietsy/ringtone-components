"use client";

import type * as React from "react";
import { StatusIcon } from "./StatusIcon";
import { formatStamp } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { PLAYER_FAMILY } from "./lib/player";
import { RAIL_FAMILIES } from "./lib/player-parts";
import { tx } from "./lib/strings";
import type { Family, Locale, PlayerCondition, PlayerValue } from "./lib/types";

export type PlayerAlertProps = {
  condition?: PlayerCondition | undefined;
  family?: Family | undefined;
  tone?: "condition" | "fault" | undefined;
  state?: string | undefined;
  when?: PlayerValue | undefined;
  title: string;
  why?: string | undefined;
  action?: string | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The stopped, fault and cannot-continue screens: the state and when, what happened, and the one thing to do.
// A licence condition and a device fault differ in their words, their action and the facts beside them;
// the fault also sets its state word in the family's text colour, because something is broken.
export function PlayerAlert(p: PlayerAlertProps) {
  const t = tx(p.locale);
  const cond = (PLAYER_FAMILY as Partial<Record<string, string>>)[String(p.condition)] ? p.condition : null;
  const family = cond
    ? PLAYER_FAMILY[cond]
    : (RAIL_FAMILIES as Partial<Record<string, number>>)[String(p.family)]
      ? p.family!
      : "danger";
  const tone = p.tone === "fault" || (!p.tone && cond === "fault") ? "fault" : "condition";
  const state = isNil(p.state) && cond ? t.deck.states[cond] : p.state;
  const when = isNil(p.when) || typeof p.when === "string" ? p.when : formatStamp(p.when, p.locale);
  return (
    <section
      className={cx("r1-palert", "r1-palert--" + family, "r1-palert--" + tone, p.className)}
      role="alert"
      style={p.style}
    >
      {state || when ? (
        <p className="r1-palert__state">
          <span className="r1-palert__icon">
            <StatusIcon family={family} size={24} cutout="page" />
          </span>
          <span className="r1-palert__stamp">
            {state ? <span className="r1-palert__word">{state}</span> : null}
            {when ? <span className="r1-palert__when r1-num">{when}</span> : null}
          </span>
        </p>
      ) : null}
      <h1 className="r1-palert__title">{p.title}</h1>
      {p.why ? <p className="r1-palert__why">{p.why}</p> : null}
      {p.action ? <p className="r1-palert__action">{p.action}</p> : null}
      {p.children ? <div className="r1-palert__foot">{p.children}</div> : null}
    </section>
  );
}

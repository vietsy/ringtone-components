"use client";

import type * as React from "react";
import { DateValue } from "./DateValue";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";
import { StatusBadge } from "./StatusBadge";
import { cx } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale, StatusValue } from "./lib/types";

export type TimelineProps = {
  entries: {
    id?: string | undefined;
    at?: string | undefined;
    actor?: string | undefined;
    title: string;
    detail?: string | undefined;
    status?: StatusValue | undefined;
    kind?: "entry" | "correction" | undefined;
    corrects?: string | undefined;
    current?: boolean | undefined;
  }[];
  showRule?: boolean | undefined;
  loading?: boolean | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// An append-only history, newest first. The current entry is marked in words for screen readers and with
// aria-current, as well as by its filled mark. loading with no entries yet draws placeholder lines.
export function Timeline(p: TimelineProps) {
  const t = tx(p.locale);
  const entries = p.entries || [];
  if (p.loading && !entries.length)
    return (
      <div className={cx("r1-timeline", p.className)} style={p.style}>
        <Skeleton variant="text" rows={3} locale={p.locale} />
      </div>
    );
  return (
    <div className={cx("r1-timeline", p.className)} style={p.style}>
      <ol className="r1-timeline__list">
        {entries.map(function (e, i) {
          return (
            <li
              key={i}
              id={e.id}
              className={cx(
                "r1-timeline__entry",
                e.kind === "correction" && "r1-timeline__entry--correction",
                e.current && "r1-timeline__entry--current",
              )}
              aria-current={e.current ? "true" : undefined}
            >
              <span className="r1-timeline__dot" aria-hidden="true" />
              <div className="r1-timeline__body">
                <p className="r1-timeline__head">
                  {e.current ? <span className="r1-sr">{t.timeline.current + " "}</span> : null}
                  {e.status ? (
                    <StatusBadge family={e.status.family} label={e.status.label} icon={e.status.icon} size="sm" />
                  ) : null}
                  <span className="r1-strong">{e.title}</span>
                </p>
                <p className="r1-timeline__meta">
                  {e.at ? <DateValue value={e.at} mode="timestamp" locale={p.locale} /> : null}
                  {e.actor ? <span className="r1-timeline__actor">{e.actor}</span> : null}
                </p>
                {e.detail ? <p className="r1-timeline__detail">{e.detail}</p> : null}
                {e.corrects ? (
                  <p className="r1-timeline__link">
                    <Icon name="link" size={16} />
                    <a className="r1-link" href={"#" + e.corrects}>
                      {t.timeline.corrects + " " + e.corrects}
                    </a>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {p.showRule === true ? <p className="r1-timeline__rule">{t.timeline.appendOnly}</p> : null}
    </div>
  );
}

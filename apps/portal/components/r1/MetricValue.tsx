"use client";

import type * as React from "react";
import { R1_FORMAT } from "@rightone/formatting";
import { FreshnessLine } from "./FreshnessLine";
import { Icon } from "./Icon";
import { formatCount, formatMoney, formatPercent } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

const percentDigits = R1_FORMAT.percentDigits;

// A figure and what kind of figure it is: observed, derived from others, a real zero, or no data yet.
function formatMetric(p: MetricValueProps): string | null {
  const v = p.value;
  if (p.kind === "money") return formatMoney(v, p.currency, p.locale);
  if (p.kind === "percent") return formatPercent(v, p.locale, { decimals: p.decimals });
  return formatCount(v, p.locale);
}

export type MetricValueProps = {
  label: string;
  value?: number | null | undefined;
  kind?: "count" | "money" | "percent" | undefined;
  currency?: string | undefined;
  unit?: string | undefined;
  state?: "observed" | "derived" | "zero" | "no-data" | undefined;
  basis?: string | undefined;
  interval?: [number, number] | undefined;
  /** percent: a fixed number of decimals, the interval too ("14,00 %"); without it at most one */ decimals?:
    number | undefined;
  note?: string | undefined;
  /** words shown in place of the dash when there is no value, such as "Không đọc được" */ missing?: string | undefined;
  freshness?: object | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function MetricValue(p: MetricValueProps) {
  const t = tx(p.locale).metric;
  const state = p.state || "observed";
  const none = state === "no-data" || isNil(p.value);
  const words = !isNil(p.missing) && p.missing !== "" ? p.missing : null;
  const low = p.interval ? Object.assign({}, p, { value: p.interval[0] }) : null,
    high = p.interval ? Object.assign({}, p, { value: p.interval[1] }) : null;
  return (
    <div
      className={cx(
        "r1-metric",
        "r1-metric--" + (p.size || "md"),
        "r1-metric--" + (none ? "no-data" : state),
        p.className,
      )}
      style={p.style}
    >
      <span className="r1-metric__label">{p.label}</span>
      <span className="r1-metric__line">
        {
          // No data: a dash read as "No data yet" when a note follows it; without a note the note line says it.
          // missing: the page's words in place of the dash ("Không đọc được"), as MoneyValue and CountValue write them.
          none ? (
            words ? (
              <span className="r1-metric__value r1-metric__value--none r1-metric__value--words">{words}</span>
            ) : (
              <span className="r1-metric__value r1-metric__value--none">
                <span aria-hidden="true">–</span>
                {p.note ? <span className="r1-sr">{t.noData}</span> : null}
              </span>
            )
          ) : (
            <span className="r1-metric__value r1-num">{formatMetric(p)}</span>
          )
        }
        {!none && p.unit ? <span className="r1-metric__unit">{p.unit}</span> : null}
      </span>
      {!none && p.interval ? (
        <span className="r1-metric__interval r1-num">
          {t.interval +
            " " +
            (p.kind === "percent"
              ? percentDigits(p.interval[0], p.locale, p.decimals) + "–" + formatMetric(high!)
              : formatMetric(low!) + "–" + formatMetric(high!))}
        </span>
      ) : null}
      {none && (p.note || !words) ? <span className="r1-metric__note">{p.note || t.noData}</span> : null}
      {
        // A derived figure says what it was worked out from, beside the route shape of the derived provenance;
        // with no basis on record it says it was worked out, and never leaves "Worked out from" hanging.
        !none && state === "derived" ? (
          <span className="r1-metric__note r1-metric__note--derived">
            <Icon name="route" size={16} />
            <span>{p.basis ? t.derived + " " + p.basis : t.derivedNoBasis}</span>
          </span>
        ) : null
      }
      {!none && p.note ? <span className="r1-metric__note">{p.note}</span> : null}
      {p.freshness ? <FreshnessLine locale={p.locale} {...p.freshness} /> : null}
    </div>
  );
}

"use client";

import type * as React from "react";
import { CountValue } from "../CountValue";
import { DateValue } from "../DateValue";
import type { DateValueProps } from "../DateValue";
import { Identifier } from "../Identifier";
import { MoneyValue } from "../MoneyValue";
import { formatPercent } from "./formatting";
import { isNil } from "./helpers";
import { tx } from "./strings";
import type { Locale } from "./types";
import { missingValue } from "./value-atoms";

/** How a Comparison row or a TracePath step writes its values; text by default. */
export type TypedKind = "text" | "money" | "count" | "percent" | "date" | "datetime" | "period" | "id";

/** What typedValue reads from the row or step besides the value; bareMoney drops the currency from each amount. */
export type TypedOptions = {
  currency?: string | undefined;
  unit?: string | undefined;
  missing?: string | undefined;
  decimals?: number | undefined;
  bareMoney?: boolean | undefined;
};

/** A period value: { from, to }. */
type PeriodValue = { from: DateValueProps["value"]; to?: DateValueProps["to"] };

// A value by its kind, drawn by the same atoms as everywhere else (MoneyValue, CountValue, DateValue), so a comparison
// and a trace write amounts, counts, dates and percentages the way the rest of the screen does. o: { currency, unit, missing }.
// v: the value as the row or step holds it, by kind: an amount in minor units, a count, a percentage, a date, a period
// ({ from, to }), a reference, or text.
export function typedValue(
  kind: TypedKind | undefined,
  v: unknown,
  o: TypedOptions,
  locale: Locale | undefined,
): React.ReactNode {
  if (isNil(v) || v === "") return missingValue(o.missing, tx(locale).noValue);
  if (kind === "money")
    return <MoneyValue amountMinor={v as number} currency={o.currency} bare={!!o.bareMoney} locale={locale} />;
  if (kind === "count") return <CountValue value={v as number} unit={o.unit} locale={locale} />;
  if (kind === "percent")
    return (
      <span className="r1-num">
        {formatPercent(v as number | string, locale, { decimals: o.decimals }) || (v as number | string)}
      </span>
    );
  if (kind === "date") return <DateValue value={v as DateValueProps["value"]} locale={locale} />;
  if (kind === "datetime") return <DateValue value={v as DateValueProps["value"]} mode="timestamp" locale={locale} />;
  if (kind === "period")
    return <DateValue value={(v as PeriodValue).from} to={(v as PeriodValue).to} mode="period" locale={locale} />;
  if (kind === "id") return <Identifier value={v as string} size="sm" copy={false} locale={locale} />;
  return o.unit ? (v as string | number) + " " + o.unit : (v as React.ReactNode);
}

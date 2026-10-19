"use client";

import type * as React from "react";
import { FieldMessage } from "./FieldMessage";
import { StatusIcon } from "./StatusIcon";
import { nf } from "./lib/formatting";
import { cx, isNil, lang, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

// Shares that must add up to 100 %: holders of one rights layer, parties to a claim. The bar shows what is left.
function parseShare(s: string | null | undefined) {
  const v = parseFloat(
    String(isNil(s) ? "" : s)
      .replace(/\s/g, "")
      .replace(",", "."),
  );
  return isNaN(v) ? null : v;
}

export type ShareSplitProps = {
  legend?: string | undefined;
  helper?: string | undefined;
  parties: {
    name: string;
    detail?: string | undefined;
    share: number;
    locked?: boolean | undefined;
    error?: string | undefined;
  }[];
  readOnly?: boolean | undefined;
  onChange?: ((parties: { name: string; share: number | null }[], index: number, e?: unknown) => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// onChange(parties with their new shares, index, event) as the reader types; the total follows.
// A row's error sits under its input, as every field's does.
export function ShareSplit(p: ShareSplitProps) {
  const t = tx(p.locale).split;
  const id = useUid("r1-split");
  const given = p.parties || [];
  const fmtShare = function (v: number) {
    return nf(p.locale, { maximumFractionDigits: 2 }).format(Number(v) || 0);
  };
  const seed = given
    .map(function (x) {
      return fmtShare(x.share);
    })
    .join("\u0001");
  const st = useSynced(seed, seed);
  const texts = st[0].split("\u0001");
  const parties = given.map(function (x, i) {
    const v = p.readOnly || x.locked ? Number(x.share) || 0 : parseShare(texts[i]);
    return Object.assign({}, x, { share: isNil(v) ? 0 : v });
  });
  function edit(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const next = texts.slice();
    next[i] = e.target.value;
    st[1](next.join("\u0001"));
    if (p.onChange)
      p.onChange(
        given.map(function (x, j) {
          const v = j === i ? parseShare(e.target.value) : parties[j]!.share;
          return Object.assign({}, x, { share: isNil(v) ? null : v });
        }),
        i,
        e,
      );
  }
  let total = parties.reduce(function (s, x) {
    return s + (Number(x.share) || 0);
  }, 0);
  total = Math.round(total * 100) / 100;
  const rest = Math.round((100 - total) * 100) / 100;
  const state = rest === 0 ? "complete" : rest > 0 ? "short" : "over";
  const pct = function (n: number) {
    return nf(p.locale, { maximumFractionDigits: 2 }).format(n) + (lang(p.locale) === "en" ? "%" : "\u00a0%");
  };
  const summary =
    state === "complete" ? t.complete : (state === "short" ? t.short : t.over).replace("{n}", pct(Math.abs(rest)));
  return (
    <fieldset
      className={cx("r1-split", "r1-split--" + state, p.className)}
      style={p.style}
      aria-describedby={[p.helper && id + "-help", id + "-sum"].filter(Boolean).join(" ")}
    >
      {p.legend ? <legend className="r1-split__legend">{p.legend}</legend> : null}
      {p.helper ? (
        <p id={id + "-help"} className="r1-field__help">
          {p.helper}
        </p>
      ) : null}
      <div className="r1-split__bar" aria-hidden="true">
        {parties.map(function (x, i) {
          return (
            <span
              key={i}
              className="r1-split__seg"
              style={{ width: Math.max(0, Math.min(100, Number(x.share) || 0)) + "%" }}
            />
          );
        })}
        {state === "short" ? <span className="r1-split__rest" style={{ width: rest + "%" }} /> : null}
      </div>
      <ul className="r1-split__list">
        {parties.map(function (x, i) {
          const iid = id + "-" + i;
          return (
            <li key={i} className={cx("r1-split__row", x.error && "r1-split__row--error")}>
              <span className="r1-split__who">
                <label className="r1-split__name" htmlFor={iid}>
                  {x.name}
                </label>
                {x.detail ? <span className="r1-split__detail">{x.detail}</span> : null}
              </span>
              {p.readOnly || x.locked ? (
                <span id={iid} className="r1-split__value r1-num">
                  {pct(Number(x.share) || 0)}
                </span>
              ) : (
                <span className="r1-affix r1-split__input">
                  <input
                    id={iid}
                    type="text"
                    inputMode="decimal"
                    className="r1-input r1-num"
                    value={texts[i]}
                    onChange={function (e) {
                      edit(i, e);
                    }}
                    aria-invalid={x.error ? "true" : undefined}
                    aria-describedby={x.error ? iid + "-err" : undefined}
                  />
                  <span className="r1-affix__part" aria-hidden="true">
                    %
                  </span>
                </span>
              )}
              {x.error ? (
                <FieldMessage id={iid + "-err"} severity="error" className="r1-split__error" locale={p.locale}>
                  {x.error}
                </FieldMessage>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p id={id + "-sum"} className="r1-split__sum" role="status">
        <StatusIcon
          family={state === "complete" ? "positive" : state === "short" ? "attention" : "danger"}
          size={16}
          cutout="surface"
        />
        <span>{t.total + " " + pct(total) + ". " + summary}</span>
      </p>
    </fieldset>
  );
}

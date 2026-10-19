"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { R1_FORMAT } from "@rightone/formatting";
import { MoneyValue } from "./MoneyValue";
import { affixName, describedBy, fieldShell, readOnlyBox } from "./lib/form-parts";
import { nf } from "./lib/formatting";
import { isNil, lang, useUid } from "./lib/helpers";
import type { FieldBase, Locale, OnValue } from "./lib/types";

const ZERO_MINOR = R1_FORMAT.ZERO_MINOR;

// An amount typed in whole units with grouped digits; the value travels in minor units, like MoneyValue.
// Whole units as people type them, in the reader's grouping: "1.250.000" in Vietnamese, "1,250,000" in English.
// Returns the minor units, the digits before the decimal separator and those after it (null when none was typed).
type MoneyParts = { minor: number; whole: string; frac: string | null };

function parseMoney(text: string | null | undefined, digits: number, locale: Locale | undefined): MoneyParts | null {
  const s = String(isNil(text) ? "" : text).replace(/\s/g, "");
  if (!digits) {
    const only = s.replace(/\D/g, "");
    return only ? { minor: Number(only), whole: only, frac: null } : null;
  }
  const dec = lang(locale) === "en" ? "." : ",";
  const at = s.lastIndexOf(dec);
  const whole = (at < 0 ? s : s.slice(0, at)).replace(/\D/g, "");
  const frac =
    at < 0
      ? null
      : s
          .slice(at + 1)
          .replace(/\D/g, "")
          .slice(0, digits);
  if (!whole && !frac) return null;
  return {
    minor: Number(whole || 0) * Math.pow(10, digits) + Number(((frac || "") + "0000").slice(0, digits)),
    whole: whole,
    frac: frac,
  };
}

function moneyText(m: MoneyParts, locale: Locale | undefined): string {
  const dec = lang(locale) === "en" ? "." : ",";
  const whole = m.whole ? nf(locale, { maximumFractionDigits: 0 }).format(Number(m.whole)) : m.frac !== null ? "0" : "";
  return whole + (m.frac !== null ? dec + m.frac : "");
}

export type MoneyFieldProps = FieldBase & {
  amountMinor?: number | null | undefined;
  currency?: string | undefined;
  placeholder?: string | undefined;
  onChange?: OnValue<number | null> | undefined;
};

// The amount groups as the reader types and travels in minor units: onChange(amountMinor | null, event).
export function MoneyField(p: MoneyFieldProps) {
  const id = useUid("r1-money");
  const cur = p.currency || "VND";
  const digits = ZERO_MINOR[cur] ? 0 : 2;
  const fixed = function (minor: number | null | undefined): string {
    return isNil(minor)
      ? ""
      : nf(p.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
          minor / Math.pow(10, digits),
        );
  };
  const shown = fixed(p.amountMinor);
  const symbol = cur;
  const text = useState(shown);
  const emitted = useRef(p.amountMinor);
  const lastProp = useRef(p.amountMinor);
  if (p.amountMinor !== lastProp.current) {
    lastProp.current = p.amountMinor;
    if (p.amountMinor !== emitted.current) text[1](shown);
  }
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(function () {
    if (caret.current === null || !inputRef.current) return;
    const el = inputRef.current,
      want = caret.current;
    let pos = 0,
      seen = 0;
    caret.current = null;
    while (pos < el.value.length && seen < want) {
      if (/\d/.test(el.value.charAt(pos))) seen++;
      pos++;
    }
    if (document.activeElement === el) el.setSelectionRange(pos, pos);
  });
  if (p.readOnly)
    return fieldShell(
      p,
      id,
      <div className="r1-field__control">
        {readOnlyBox(p, id, <MoneyValue amountMinor={p.amountMinor ?? null} currency={cur} locale={p.locale} />, "r1-num")}
      </div>,
    );
  const input = (
    <input
      ref={inputRef}
      id={id}
      name={p.name}
      type="text"
      inputMode={digits ? "decimal" : "numeric"}
      className="r1-input r1-num r1-money__input"
      value={text[0]}
      placeholder={p.placeholder}
      disabled={p.disabled}
      required={p.required}
      autoComplete="off"
      aria-invalid={p.error ? "true" : undefined}
      aria-describedby={describedBy(p, id)}
      aria-labelledby={affixName(id, null, true)}
      onChange={function (e) {
        const raw = e.target.value;
        const at = isNil(e.target.selectionStart) ? raw.length : e.target.selectionStart;
        const m = parseMoney(raw, digits, p.locale);
        caret.current = raw.slice(0, at).replace(/\D/g, "").length;
        text[1](m ? moneyText(m, p.locale) : "");
        emitted.current = m ? m.minor : null;
        if (p.onChange) p.onChange(emitted.current, e);
      }}
      onBlur={function (e) {
        const m = parseMoney(text[0], digits, p.locale);
        if (m && digits) text[1](fixed(m.minor));
        if (p.onBlur) p.onBlur(e);
      }}
    />
  );
  return fieldShell(
    p,
    id,
    <div className="r1-field__control" style={p.width ? { maxWidth: p.width } : undefined}>
      <div className="r1-affix">
        {input}
        <span id={id + "-suf"} className="r1-affix__part">
          {symbol}
        </span>
      </div>
    </div>,
  );
}

"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";
import { FieldMessage } from "./FieldMessage";
import { Icon } from "./Icon";
import { announce, cx, focusEl, isNil, readerActed, useLatest, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale, OnValue } from "./lib/types";

export type CodeInputProps = {
  label: string;
  helper?: string | undefined;
  length?: number | undefined;
  chars?: "digits" | "alnum" | undefined;
  group?: number | undefined;
  digits?: string[] | undefined;
  value?: string | undefined;
  focus?: number | undefined;
  error?: string | undefined;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  onChange?: OnValue<string> | undefined;
  onComplete?: ((code: string) => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A short numeric code in one box per digit: pairing a device, confirming a contact channel.
// Inside a Player frame the boxes take the frame's --code-digit-* sizes.
// One box per digit that behaves as one field: typing moves on, Backspace in an empty box goes back,
// arrows move, and a pasted or autofilled code fills every box. onChange(code), onComplete(code).
// loading: the code is being checked; the boxes turn read-only and keep focus, and a line says so.
// disabled states its reason with disabledReason.
export function CodeInput(p: CodeInputProps) {
  const t = tx(p.locale);
  const id = useUid("r1-code");
  const busy = !!p.loading;
  useEffect(
    function () {
      if (busy && readerActed()) announce(t.codeInput.checking, "polite");
    },
    [busy],
  );
  const described =
    [
      p.helper && id + "-help",
      p.error && id + "-msg",
      busy && id + "-busy",
      p.disabled && p.disabledReason && id + "-why",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const n = p.length || 6;
  // chars="alnum": letters and digits, written in capitals (a pairing code). group: boxes per block, so a long code
  // reads in blocks and wraps between them, never inside one.
  const alnum = p.chars === "alnum";
  const per = p.group !== undefined && p.group > 0 && p.group < n ? p.group : 0;
  function clean(v: string): string {
    v = String(v || "").replace(alnum ? /[^0-9a-z]/gi : /\D/g, "");
    return alnum ? v.toUpperCase() : v;
  }
  const given = p.digits
    ? p.digits
        .map(function (d) {
          return d || " ";
        })
        .join("")
    : isNil(p.value)
      ? undefined
      : String(p.value);
  const st = useSynced(given, "");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const goTo = useRef<number | null>(null);
  const latest = useLatest(p);
  const boxes: string[] = [];
  for (let i = 0; i < n; i++) {
    const ch = st[0].charAt(i);
    boxes.push(ch && ch !== " " ? ch : "");
  }
  const focus = isNil(p.focus) ? -1 : p.focus;
  useEffect(function () {
    if (goTo.current !== null) {
      focusEl(refs.current[goTo.current]);
      goTo.current = null;
    }
  });
  function commit(next: string[], focusAt: number | null, e: React.SyntheticEvent) {
    st[1](
      next
        .map(function (d) {
          return d || " ";
        })
        .join("")
        .replace(/\s+$/, ""),
    );
    if (!isNil(focusAt)) goTo.current = Math.max(0, Math.min(n - 1, focusAt));
    const code = next.join("");
    if (latest.current.onChange) latest.current.onChange(code, e);
    if (code.length === n && latest.current.onComplete) latest.current.onComplete(code);
  }
  function fill(at: number, digits: string, e: React.SyntheticEvent) {
    const next = boxes.slice();
    for (let k = 0; k < digits.length && at + k < n; k++) next[at + k] = digits.charAt(k);
    commit(next, at + digits.length, e);
  }
  function onChange(i: number) {
    return function (e: React.ChangeEvent<HTMLInputElement>) {
      if (latest.current.loading) return;
      let d = clean(e.target.value);
      if (!d) {
        const next = boxes.slice();
        next[i] = "";
        commit(next, null, e);
        return;
      }
      if (d.length >= n) {
        fill(0, d.slice(0, n), e);
        return;
      }
      if (boxes[i] && d.length === 2 && d.charAt(0) === boxes[i]) d = d.charAt(1);
      fill(i, d, e);
    };
  }
  function onKey(i: number) {
    return function (e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Backspace" && !boxes[i] && i > 0 && !latest.current.loading) {
        e.preventDefault();
        const next = boxes.slice();
        next[i - 1] = "";
        commit(next, i - 1, e);
      } else if (e.key === "ArrowLeft" && i > 0) {
        e.preventDefault();
        focusEl(refs.current[i - 1]);
      } else if (e.key === "ArrowRight" && i < n - 1) {
        e.preventDefault();
        focusEl(refs.current[i + 1]);
      }
    };
  }
  function blocks(inputs: React.ReactElement[]): React.ReactElement[] {
    if (!per) return inputs;
    const out: React.ReactElement[] = [];
    for (let b = 0; b < inputs.length; b += per)
      out.push(
        <span key={"b" + b} className="r1-code__group">
          {inputs.slice(b, b + per)}
        </span>,
      );
    return out;
  }
  function onPaste(i: number) {
    return function (e: React.ClipboardEvent<HTMLInputElement>) {
      if (latest.current.loading) {
        e.preventDefault();
        return;
      }
      const d = clean((e.clipboardData && e.clipboardData.getData("text")) || "");
      if (!d) return;
      e.preventDefault();
      fill(d.length >= n ? 0 : i, d.slice(0, n), e);
    };
  }
  return (
    <div className={cx("r1-code", p.error && "r1-code--error", busy && "r1-code--busy", p.className)} style={p.style}>
      <label id={id + "-label"} className="r1-code__label" htmlFor={id + "-0"}>
        {p.label}
      </label>
      {p.helper ? (
        <p id={id + "-help"} className="r1-field__help">
          {p.helper}
        </p>
      ) : null}
      <div
        className={cx("r1-code__boxes", per && "r1-code__boxes--grouped")}
        role="group"
        aria-labelledby={id + "-label"}
        aria-busy={busy ? "true" : undefined}
      >
        {blocks(
          boxes.map(function (v, i) {
            return (
              <input
                key={i}
                id={id + "-" + i}
                className={cx("r1-code__box", i === focus && "r1-code__box--focus")}
                ref={function (el) {
                  refs.current[i] = el;
                }}
                value={v}
                onChange={onChange(i)}
                onKeyDown={onKey(i)}
                onPaste={onPaste(i)}
                onFocus={function (e) {
                  e.target.select();
                }}
                inputMode={alnum ? "text" : "numeric"}
                autoCapitalize={alnum ? "characters" : undefined}
                spellCheck={false}
                autoComplete={i === 0 && !alnum ? "one-time-code" : "off"}
                maxLength={n}
                disabled={p.disabled}
                readOnly={busy}
                aria-label={
                  (alnum ? t.codeInput.char : t.codeInput.digit) + " " + (i + 1) + " " + t.codeInput.of + " " + n
                }
                aria-invalid={p.error ? "true" : undefined}
                aria-describedby={described}
              />
            );
          }),
        )}
      </div>
      {busy ? (
        <p id={id + "-busy"} className="r1-code__busy">
          <Icon name="loader-circle" size={16} spin={true} />
          <span>{t.codeInput.checking}</span>
        </p>
      ) : null}
      {p.error ? (
        <FieldMessage id={id + "-msg"} severity="error" locale={p.locale}>
          {p.error}
        </FieldMessage>
      ) : null}
      {p.disabled && p.disabledReason ? (
        <div id={id + "-why"} className="r1-field__reason">
          <Icon name="info" size={16} />
          <span>{p.disabledReason}</span>
        </div>
      ) : null}
    </div>
  );
}

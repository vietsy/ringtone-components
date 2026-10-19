"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { announce, cx, focusEl, isNil } from "./lib/helpers";
import { tx } from "./lib/strings";
import { idChars, maskValue, missingValue } from "./lib/value-atoms";
import type { Locale } from "./lib/types";

export type IdentifierProps = {
  value: string | null;
  /** md: text-base (default); sm: text-sm, in tables; lg: text-lg, a reference read aloud over the phone */ size?:
    "sm" | "md" | "lg" | undefined;
  copy?: boolean | undefined;
  /** a long key written in blocks separated by spaces (an authenticator key): it may break between two blocks */ grouped?:
    boolean | undefined;
  /** words shown instead of the dash when no reference exists yet, such as "Chưa cấp" */ missing?: string | undefined;
  /** every character but the last four is a dot, with a Show / Hide control ("Hiện đầy đủ mã" / "Show the full reference"); copy still copies the whole value */ mask?:
    boolean | undefined;
  /** only the last n characters after an ellipsis; the whole value is the accessible name and the title, and shows while the value has focus. Ignored with mask */ tail?:
    number | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
};

export function Identifier(p: IdentifierProps) {
  const t = tx(p.locale);
  const st = useState("idle");
  const revealed = useState(false);
  const focused = useState(false);
  const valueRef = useRef<HTMLSpanElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(function () {
    return function () {
      clearTimeout(timer.current);
    };
  }, []);
  const value = isNil(p.value) || String(p.value).trim() === "" ? null : String(p.value).trim();
  if (value === null) return missingValue(p.missing, t.noId, p.className);
  const masked = !!p.mask && !revealed[0];
  const bare = idChars(value);
  const ending = bare.length > 4 ? t.idMask.ending.replace("{tail}", bare.slice(-4)) : t.idMask.hiddenValue;
  const tailN = !p.mask && Number(p.tail) > 0 && value.length > Number(p.tail) ? Math.floor(Number(p.tail)) : 0;
  const spoken = masked ? ending : value;
  function show(next: string) {
    st[1](next);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      function () {
        st[1]("idle");
      },
      next === "failed" ? 6000 : 1600,
    );
  }
  function selectValue() {
    try {
      const r = document.createRange();
      r.selectNodeContents(valueRef.current!);
      const sel = window.getSelection();
      sel!.removeAllRanges();
      sel!.addRange(r);
      return sel;
    } catch {
      return null;
    }
  }
  // A hidden or shortened value is not what is on screen, so the fallback copies it from a field off screen.
  function offscreenCopy() {
    const ta = document.createElement("textarea");
    let ok = false;
    ta.value = value!;
    ta.setAttribute("readonly", "");
    ta.className = "r1-sr";
    document.body.appendChild(ta);
    try {
      ta.select();
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
  function legacyCopy() {
    if (masked || (tailN && !focused[0])) return offscreenCopy();
    const sel = selectValue();
    let ok = false;
    try {
      ok = !!sel && document.execCommand("copy");
    } catch {
      ok = false;
    }
    if (ok && sel) sel.removeAllRanges();
    return ok;
  }
  function done() {
    show("copied");
    announce(t.copied + " " + spoken);
  }
  function fail() {
    show("failed");
    if (masked) {
      announce(t.idMask.copyFailed);
      return;
    }
    announce(t.copyFailed);
    // A shortened value shows whole once it has focus, then it is selected for the reader to copy.
    if (tailN && valueRef.current) {
      focusEl(valueRef.current);
      setTimeout(selectValue, 0);
    } else selectValue();
  }
  function onCopy() {
    const c = typeof navigator !== "undefined" ? navigator.clipboard : null;
    if (c && c.writeText) {
      try {
        c.writeText(value!).then(done, function () {
          if (legacyCopy()) done();
          else fail();
        });
        return;
      } catch {
        /* fall through */
      }
    }
    if (legacyCopy()) done();
    else fail();
  }
  function onReveal() {
    announce(revealed[0] ? t.idMask.hidden : t.idMask.shown);
    revealed[1](!revealed[0]);
  }
  let text: React.ReactNode;
  if (masked) {
    text = (
      <span ref={valueRef} className="r1-mono r1-id__value r1-id__value--masked">
        <span aria-hidden="true">{maskValue(value)}</span>
        <span className="r1-sr">{ending}</span>
      </span>
    );
  } else if (tailN) {
    const whole = focused[0];
    text = (
      <span
        ref={valueRef}
        className={cx("r1-mono r1-id__value r1-id__value--tail", whole && "r1-id__value--whole")}
        tabIndex={0}
        title={value}
        onFocus={function () {
          focused[1](true);
        }}
        onBlur={function () {
          focused[1](false);
        }}
      >
        {whole
          ? value
          : [
              <span key="v" aria-hidden="true">
                {"\u2026" + value.slice(-tailN)}
              </span>,
              <span key="s" className="r1-sr">
                {value}
              </span>,
            ]}
      </span>
    );
  } else {
    text = (
      <span ref={valueRef} className="r1-mono r1-id__value">
        {value}
      </span>
    );
  }
  // grouped: a long key written in blocks (an authenticator key) may break between two blocks, never inside one
  // size 'lg': a reference read aloud over the phone, at text-lg (never letter-spaced: it matches the printed record).
  return (
    <span
      className={cx(
        "r1-id",
        "r1-id--" + (p.size === "sm" || p.size === "lg" ? p.size : "md"),
        p.grouped && "r1-id--grouped",
        p.className,
      )}
    >
      {text}
      {p.mask ? (
        <button
          type="button"
          className="r1-id__reveal"
          onClick={onReveal}
          aria-label={revealed[0] ? t.idMask.hideName : t.idMask.showName}
        >
          <Icon name={revealed[0] ? "eye-off" : "eye"} size={16} />
          <span aria-hidden="true">{revealed[0] ? t.idMask.hide : t.idMask.show}</span>
        </button>
      ) : null}
      {p.copy === false ? null : (
        <button type="button" className="r1-id__copy" onClick={onCopy} aria-label={t.copy + " " + spoken}>
          <Icon name={st[0] === "copied" ? "check" : "copy"} size={16} />
        </button>
      )}
      {st[0] === "failed" ? <span className="r1-id__msg">{t.copyFailedShort}</span> : null}
    </span>
  );
}

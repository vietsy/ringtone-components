"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "./Calendar";
import { FieldMessage } from "./FieldMessage";
import { Icon } from "./Icon";
import { daysIn, ymd, ymdKey } from "./lib/dates";
import { describedBy, fieldIconSize, fieldShell, readOnlyBox } from "./lib/form-parts";
import { formatDate, formatPeriod, formatTimestamp, offsetLabel } from "./lib/formatting";
import { announce, cx, focusEl, isNil, pad2, textOf, useLatest, useSynced, useUid } from "./lib/helpers";
import { parseTime, snapTime } from "./lib/more-inputs";
import { tx } from "./lib/strings";
import type { FieldBase, OnValue } from "./lib/types";

function dmy(v: string) {
  const o = ymd(v);
  return o ? pad2(o.d) + "/" + pad2(o.m) + "/" + o.y : "";
}

// Day/month/year as people type it: 3/10/2026, 03.10.2026, 03-10-2026, or 03102026 from a number pad.
function parseDmy(s: string | null | undefined) {
  const str = String(isNil(s) ? "" : s).trim();
  const m =
    /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(str) || /^(\d{2})(\d{2})(\d{4})$/.exec(str);
  if (!m) return null;
  const d = +m[1]!,
    mo = +m[2]!,
    y = +m[3]!;
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null;
  return ymdKey({ y: y, m: mo, d: d });
}

export type DateFieldProps = Omit<FieldBase, "helper"> & {
  helper?: string | false | undefined;
  value?: string | undefined;
  range?: boolean | undefined;
  to?: string | undefined;
  fromLabel?: string | undefined;
  toLabel?: string | undefined;
  withTime?: boolean | undefined;
  time?: string | undefined;
  step?: number | undefined;
  dateLabel?: string | undefined;
  timeLabel?: string | undefined;
  open?: boolean | undefined;
  month?: string | undefined;
  today?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
  onChange?: OnValue<string | null | { from: string | null; to: string | null }> | undefined;
  onPick?: ((ymd: string) => void) | undefined;
  placeholder?: string | undefined;
  toPlaceholder?: string | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A date typed as day/month/year or picked. range=true asks for a start and an end in one group.
// onChange gets 'YYYY-MM-DD' (or { from, to } for a range) once the text is a whole date, and null when emptied.
// withTime adds a time on the 24-hour clock in the same group, with one label and one helper, and the zone
// stated once beside the time. Everything is Vietnam time (+07:00, no daylight saving): onChange then gets
// 'YYYY-MM-DDTHH:MM+07:00' once both parts are whole, else null.
export function DateField(p: DateFieldProps) {
  const t = tx(p.locale);
  const id = useUid("r1-df");
  const open = useState(!!p.open);
  const from = useSynced(isNil(p.value) ? p.value : String(p.value).slice(0, 10), null);
  const timeText = useSynced(p.time || (/T(\d{2}:\d{2})/.exec(String(p.value || "")) || [])[1], "");
  const withTime = !!p.withTime && !p.range;
  const step = Number(p.step) > 1 ? Math.round(p.step!) : 0;
  const to = useSynced(p.to, null);
  const textA = useSynced(isNil(p.value) ? undefined : dmy(p.value), "");
  const textB = useSynced(isNil(p.to) ? undefined : dmy(p.to), "");
  const month = useSynced(p.month, String(from[0] || p.today || "2026-01-01").slice(0, 7));
  const side = useRef<"a" | "b">("a");
  const byReader = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useLatest(p);
  const isOpen = open[0] && !p.disabled && !p.readOnly;
  useEffect(
    function () {
      if (!isOpen || !byReader.current) return undefined;
      function onDown(e: MouseEvent) {
        if (rootRef.current && !rootRef.current.contains(e.target as Node | null)) open[1](false);
      }
      document.addEventListener("mousedown", onDown);
      return function () {
        document.removeEventListener("mousedown", onDown);
      };
    },
    [isOpen],
  );
  function emit(a: string | null, b: string | null, e?: React.SyntheticEvent<HTMLInputElement>) {
    const q = latest.current;
    if (!q.onChange) return;
    if (q.range) q.onChange({ from: a, to: b }, e);
    else if (withTime) emitAt(a, parseTime(timeText[0]), e);
    else q.onChange(a, e);
  }
  function emitAt(dk: string | null, tv: string | null, e?: React.SyntheticEvent<HTMLInputElement>) {
    const q = latest.current;
    if (q.onChange) q.onChange(dk && tv ? dk + "T" + tv + "+07:00" : null, e);
  }
  const dtHelp = withTime
    ? Object.assign({}, p, {
        helper:
          p.helper === false
            ? null
            : p.helper || (step ? t.date.helpDateTimeStep.replace("{n}", String(step)) : t.date.helpDateTime),
      })
    : p;
  function close(focusSel: string) {
    open[1](false);
    if (rootRef.current) focusEl(rootRef.current.querySelector<HTMLElement>(focusSel));
  }
  function pick(k: string) {
    if (p.onPick) p.onPick(k);
    if (!p.range) {
      from[1](k);
      textA[1](dmy(k));
      emit(k, null);
      close("#" + id + "-a");
      return;
    }
    if (side.current === "a" || !from[0] || k < from[0]) {
      from[1](k);
      textA[1](dmy(k));
      if (to[0] && k > to[0]) {
        to[1](null);
        textB[1]("");
      }
      side.current = "b";
      emit(k, to[0] && k <= to[0] ? to[0] : null);
      return;
    }
    to[1](k);
    textB[1](dmy(k));
    side.current = "a";
    emit(from[0], k);
    close("#" + id + "-b");
  }
  function typed(which: "a" | "b", v: string, e: React.ChangeEvent<HTMLInputElement>) {
    const k = parseDmy(v);
    if (which === "a") {
      textA[1](v);
      if (k || !v.trim()) {
        from[1](k);
        if (k) month[1](k.slice(0, 7));
        emit(k, to[0], e);
      }
    } else {
      textB[1](v);
      if (k || !v.trim()) {
        to[1](k);
        emit(from[0], k, e);
      }
    }
  }
  function input(which: "a" | "b", label?: string) {
    const iid = id + "-" + which;
    return (
      <div className="r1-datef__part">
        {label ? (
          <label className="r1-datef__sublabel" htmlFor={iid}>
            {label}
          </label>
        ) : null}
        <div className="r1-datef__box">
          <input
            id={iid}
            name={p.name && !withTime ? (p.range ? p.name + (which === "a" ? "-from" : "-to") : p.name) : undefined}
            type="text"
            inputMode="numeric"
            className="r1-input r1-datef__input"
            value={which === "a" ? textA[0] : textB[0]}
            placeholder={(which === "b" && p.toPlaceholder) || p.placeholder || t.date.placeholder}
            disabled={p.disabled}
            required={p.required}
            autoComplete="off"
            aria-invalid={p.error ? "true" : undefined}
            aria-describedby={describedBy(dtHelp, p.range || withTime ? id : id + "-a")}
            onChange={function (e) {
              typed(which, e.target.value, e);
            }}
            onBlur={p.onBlur}
          />
          <button
            type="button"
            className="r1-datef__pick"
            disabled={p.disabled}
            data-side={which}
            aria-label={t.date.choose + ": " + (label || textOf(p.label))}
            aria-expanded={isOpen ? "true" : "false"}
            aria-controls={id + "-cal"}
            onClick={function () {
              side.current = which;
              byReader.current = true;
              open[1](!open[0]);
            }}
          >
            <Icon name="calendar" size={fieldIconSize(p)} />
          </button>
        </div>
      </div>
    );
  }
  const cal = isOpen ? (
    <div
      id={id + "-cal"}
      className="r1-datef__pop"
      onKeyDown={function (e) {
        if (e.key === "Escape") {
          e.preventDefault();
          close('[data-side="' + side.current + '"]');
        }
      }}
    >
      <Calendar
        value={from[0]}
        to={p.range ? to[0] : null}
        month={month[0]}
        onMonthChange={month[1]}
        today={p.today}
        min={p.min}
        max={p.max}
        onPick={pick}
        density={p.density}
        locale={p.locale}
      />
    </div>
  ) : null;
  const tv = parseTime(timeText[0]);
  if (p.readOnly) {
    const shown = p.range
      ? formatPeriod(p.value, p.to, p.locale)
      : withTime && from[0] && tv
        ? formatTimestamp(from[0] + "T" + tv + ":00+07:00", p.locale)
        : formatDate(from[0], p.locale);
    return fieldShell(p, id, <div className="r1-field__control">{readOnlyBox(p, id, shown || "–")}</div>);
  }
  if (withTime) {
    const tid = id + "-t";
    const zone = offsetLabel(new Date());
    return (
      <div
        role="group"
        aria-labelledby={id + "-label"}
        className={cx(
          "r1-field r1-datef-range r1-datef-dt",
          "r1-field--" + (p.density || "portal"),
          p.error && "r1-field--error",
          p.className,
        )}
        style={p.style}
      >
        <div className="r1-field__head">
          <span id={id + "-label"} className="r1-field__label">
            {p.label}
          </span>
          {p.required ? <span className="r1-field__req">{t.required}</span> : null}
        </div>
        {dtHelp.helper ? (
          <div id={id + "-help"} className="r1-field__help">
            {dtHelp.helper}
          </div>
        ) : null}
        <div ref={rootRef} className="r1-datef r1-datef--range">
          {input("a", p.dateLabel || t.date.day)}
          <div className="r1-datef__part r1-datef__part--time">
            <label id={tid + "-lbl"} className="r1-datef__sublabel" htmlFor={tid}>
              {p.timeLabel || t.date.time}
            </label>
            <div className="r1-datef__timebox">
              <div className="r1-time">
                <Icon name="clock" size={fieldIconSize(p)} className="r1-time__icon" />
                <input
                  id={tid}
                  type="text"
                  inputMode="numeric"
                  className="r1-input r1-num r1-time__input"
                  value={timeText[0]}
                  placeholder="hh:mm"
                  maxLength={5}
                  disabled={p.disabled}
                  required={p.required}
                  autoComplete="off"
                  aria-invalid={p.error ? "true" : undefined}
                  aria-labelledby={tid + "-lbl " + tid + "-zone"}
                  aria-describedby={describedBy(dtHelp, id)}
                  onChange={function (e) {
                    timeText[1](e.target.value);
                    emitAt(from[0], parseTime(e.target.value), e);
                  }}
                  onBlur={function (e) {
                    const v = parseTime(timeText[0]);
                    const sn = snapTime(v, step, false);
                    if (sn && sn !== v) {
                      announce(t.time.rounded.replace("{t}", sn));
                      timeText[1](sn);
                      emitAt(from[0], sn, e);
                    } else if (v) timeText[1](v);
                    if (p.onBlur) p.onBlur(e);
                  }}
                />
              </div>
              <span id={tid + "-zone"} className="r1-datef__zone">
                {zone}
              </span>
            </div>
          </div>
          {cal}
        </div>
        {p.name ? (
          <input type="hidden" name={p.name} value={from[0] && tv ? from[0] + "T" + tv + "+07:00" : ""} />
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
  if (!p.range)
    return fieldShell(
      p,
      id + "-a",
      <div ref={rootRef} className="r1-field__control r1-datef" style={p.width ? { maxWidth: p.width } : undefined}>
        {input("a")}
        {cal}
      </div>,
    );
  // A range is one group named by its label; the required mark sits beside the label, outside the name, as on
  // every other field, and each input carries required itself.
  return (
    <div
      role="group"
      aria-labelledby={id + "-label"}
      className={cx(
        "r1-field r1-datef-range",
        "r1-field--" + (p.density || "portal"),
        p.error && "r1-field--error",
        p.className,
      )}
      style={p.style}
    >
      <div className="r1-field__head">
        <span id={id + "-label"} className="r1-field__label">
          {p.label}
        </span>
        {p.required ? <span className="r1-field__req">{t.required}</span> : null}
      </div>
      {p.helper ? (
        <div id={id + "-help"} className="r1-field__help">
          {p.helper}
        </div>
      ) : null}
      <div ref={rootRef} className="r1-datef r1-datef--range">
        {input("a", p.fromLabel || t.date.from)}
        {input("b", p.toLabel || t.date.to)}
        {cal}
      </div>
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

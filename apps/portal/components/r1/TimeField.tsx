"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { describedBy, fieldIconSize, fieldShell, readOnlyBox } from "./lib/form-parts";
import { announce, pad2, useSynced, useUid } from "./lib/helpers";
import { parseTime, snapTime } from "./lib/more-inputs";
import { tx } from "./lib/strings";
import type { FieldBase, OnValue } from "./lib/types";

export type TimeFieldProps = Omit<FieldBase, "helper"> & {
  helper?: string | false | undefined;
  value?: string | undefined;
  endOfDay?: boolean | undefined;
  step?: number | undefined;
  onChange?: OnValue<string | null> | undefined;
};

// A time of day on the 24-hour clock. endOfDay allows 24:00 for a period that runs to midnight.
// onChange gets 'HH:MM' or null while the text is not a time; leaving the field writes the time out in full.
// step (minutes) keeps the time on that step: leaving the field rounds to the nearest one and says so, and
// ArrowUp and ArrowDown move by one step.
export function TimeField(p: TimeFieldProps) {
  const t = tx(p.locale);
  const id = useUid("r1-time");
  const text = useSynced(p.value, "");
  const step = p.step !== undefined && p.step > 1 ? Math.round(p.step) : 0;
  if (p.readOnly)
    return fieldShell(p, id, <div className="r1-field__control">{readOnlyBox(p, id, p.value || "–", "r1-num")}</div>);
  const example = step && 30 % step !== 0 ? "18:00" : "18:30";
  const auto = step
    ? (p.endOfDay ? t.time.helpStepEnd : t.time.helpStep).replace("{n}", String(step)).replace("{e}", example)
    : p.endOfDay
      ? t.time.helpEnd
      : t.time.help;
  const helpP = Object.assign({}, p, { helper: p.helper === false ? null : p.helper || auto });
  function put(v: string, e: React.SyntheticEvent<HTMLInputElement>) {
    text[1](v);
    if (p.onChange) p.onChange(v, e);
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!step || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const cur = parseTime(text[0], p.endOfDay);
    const last = p.endOfDay ? 1440 : Math.floor(1439 / step) * step;
    let mins: number;
    if (!cur) mins = e.key === "ArrowUp" ? 0 : last;
    else {
      const x = snapTime(cur, step, p.endOfDay)!.split(":");
      mins = Number(x[0]) * 60 + Number(x[1]) + (e.key === "ArrowUp" ? step : -step);
      mins = Math.max(0, Math.min(mins, last));
    }
    put(pad2(Math.floor(mins / 60)) + ":" + pad2(mins % 60), e);
  }
  return fieldShell(
    helpP,
    id,
    <div className="r1-field__control r1-time" style={{ maxWidth: p.width || "var(--space-40)" }}>
      <Icon name="clock" size={fieldIconSize(p)} className="r1-time__icon" />
      <input
        id={id}
        name={p.name}
        type="text"
        inputMode="numeric"
        className="r1-input r1-num r1-time__input"
        value={text[0]}
        placeholder="hh:mm"
        maxLength={5}
        disabled={p.disabled}
        required={p.required}
        autoComplete="off"
        aria-invalid={p.error ? "true" : undefined}
        aria-describedby={describedBy(helpP, id)}
        onChange={function (e) {
          text[1](e.target.value);
          if (p.onChange) p.onChange(parseTime(e.target.value, p.endOfDay), e);
        }}
        onKeyDown={onKey}
        onBlur={function (e) {
          const v = parseTime(text[0], p.endOfDay);
          const s = snapTime(v, step, p.endOfDay);
          if (s && s !== v) {
            announce(t.time.rounded.replace("{t}", s));
            put(s, e);
          } else if (v) text[1](v);
          if (p.onBlur) p.onBlur(e);
        }}
      />
    </div>,
  );
}

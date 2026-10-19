"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { StatusIcon } from "./StatusIcon";
import { describedBy, fieldIconSize, fieldShell } from "./lib/form-parts";
import { announce, cx, isNil, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { FieldBase, OnValue } from "./lib/types";

export type PasswordFieldProps = FieldBase & {
  value?: string | undefined;
  onChange?: OnValue<string> | undefined;
  revealed?: boolean | undefined;
  rules?: { text: string; met: boolean }[] | undefined;
  autoComplete?: "current-password" | "new-password" | undefined;
};

// A password with a way to see it, and, for a new one, the rules it must meet.
export function PasswordField(p: PasswordFieldProps) {
  const t = tx(p.locale);
  const id = useUid("r1-pw");
  const shown = useState(!!p.revealed);
  const pv = useSynced(isNil(p.value) ? "" : String(p.value), "");
  const rules = p.rules || [];
  const describe = [describedBy(p, id), rules.length ? id + "-rules" : null].filter(Boolean).join(" ") || undefined;
  const control = (
    <div className="r1-pw">
      <input
        id={id}
        name={p.name}
        type={shown[0] ? "text" : "password"}
        className="r1-input r1-pw__input"
        value={pv[0]}
        spellCheck={false}
        autoComplete={p.autoComplete || "current-password"}
        required={p.required}
        disabled={p.disabled}
        onChange={function (e) {
          pv[1](e.target.value);
          if (p.onChange) p.onChange(e.target.value, e);
        }}
        onBlur={p.onBlur}
        aria-invalid={p.error ? "true" : undefined}
        aria-describedby={describe}
      />
      <button
        type="button"
        className="r1-pw__toggle"
        aria-controls={id}
        disabled={p.disabled}
        aria-label={shown[0] ? t.password.hide : t.password.show}
        onClick={function () {
          announce(shown[0] ? t.password.hidden : t.password.visible);
          shown[1](!shown[0]);
        }}
      >
        <Icon name={shown[0] ? "eye-off" : "eye"} size={fieldIconSize(p)} />
        <span aria-hidden="true">{shown[0] ? t.password.hideShort : t.password.showShort}</span>
      </button>
    </div>
  );
  const list = rules.length ? (
    <ul id={id + "-rules"} className="r1-pw__rules">
      {rules.map(function (r, i) {
        return (
          <li key={i} className={cx("r1-pw__rule", r.met && "r1-pw__rule--met")}>
            <StatusIcon family={r.met ? "positive" : "neutral"} size={16} cutout="surface" />
            <span>{r.text}</span>
            <span className="r1-sr">{", " + (r.met ? t.password.met : t.password.notMet)}</span>
          </li>
        );
      })}
    </ul>
  ) : null;
  return fieldShell(
    p,
    id,
    <div className="r1-field__control" style={p.width ? { maxWidth: p.width } : undefined}>
      {control}
    </div>,
    list,
  );
}

"use client";

import type * as React from "react";
import { FieldMessage } from "./FieldMessage";
import { Icon } from "./Icon";
import { choiceMark } from "./lib/choice-controls";
import { cx, isNil, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type CheckboxProps = {
  label?: React.ReactNode | undefined;
  helper?: string | undefined;
  hint?: string | undefined;
  checked?: boolean | undefined;
  indeterminate?: boolean | undefined;
  required?: boolean | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  readOnly?: boolean | undefined;
  layout?: "plain" | "card" | undefined;
  density?: "console" | "portal" | "premises" | undefined;
  name?: string | undefined;
  value?: string | undefined;
  onChange?: ((e: unknown) => void) | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Ticked and "some ticked" are the box's own state, reset whenever the page passes a new value: a click clears
// "some ticked", and a later render does not bring it back. readOnly shows a registry fact: named by its label,
// reached by Tab, never a disabled box.
export function Checkbox(p: CheckboxProps) {
  const t = tx(p.locale);
  const id = useUid("r1-cb");
  const on = useSynced(!!p.checked, false);
  const some = useSynced(!!p.indeterminate, false);
  const help = isNil(p.helper) ? p.hint : p.helper;
  const ids =
    [help && id + "-hint", p.error && id + "-msg", p.disabled && p.disabledReason && id + "-why"]
      .filter(Boolean)
      .join(" ") || undefined;
  const text = (
    <span className="r1-check__text">
      <span id={id + "-label"} className="r1-check__label">
        {p.label || p.children}
        {p.required && !p.readOnly ? <span className="r1-field__req">{t.required}</span> : null}
      </span>
      {help ? (
        <span id={id + "-hint"} className="r1-check__hint">
          {help}
        </span>
      ) : null}
    </span>
  );
  const body = p.readOnly ? (
    <div className="r1-choice r1-choice--readonly">
      <span
        id={id}
        className="r1-check__ro"
        role="checkbox"
        tabIndex={0}
        aria-readonly="true"
        aria-checked={some[0] ? "mixed" : on[0] ? "true" : "false"}
        aria-labelledby={id + "-label"}
        aria-describedby={ids}
      >
        <span className="r1-check__box" aria-hidden="true">
          {on[0] || some[0] ? <Icon name={some[0] ? "minus" : "check"} size={12} strokeWidth={3} /> : null}
        </span>
      </span>
      {text}
    </div>
  ) : (
    <label className="r1-choice" htmlFor={id}>
      {choiceMark(
        "checkbox",
        {
          id: id,
          name: p.name,
          value: p.value,
          checked: on[0],
          disabled: p.disabled,
          required: p.required,
          "aria-invalid": p.error ? "true" : undefined,
          "aria-describedby": ids,
          onChange: function (e: React.ChangeEvent<HTMLInputElement>) {
            some[1](false);
            on[1](e.target.checked);
            if (p.onChange) p.onChange(e);
          },
        },
        some[0],
      )}
      {text}
    </label>
  );
  return (
    <div
      className={cx(
        "r1-check",
        "r1-check--" + (p.density || "console"),
        p.layout === "card" && "r1-check--card",
        (on[0] || some[0]) && "r1-check--on",
        p.readOnly && "r1-check--readonly",
        p.error && "r1-check--error",
        p.disabled && "r1-check--disabled",
        p.className,
      )}
      style={p.style}
    >
      {body}
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

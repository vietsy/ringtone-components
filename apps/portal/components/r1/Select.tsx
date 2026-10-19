"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { describedBy, fieldIconSize, fieldShell, readOnlyBox, sizedField } from "./lib/form-parts";
import { formatDate } from "./lib/formatting";
import { isNil, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { FieldBase, OnValue } from "./lib/types";

export type SelectProps = FieldBase & {
  options: { value: string; label: string }[];
  value?: string | undefined;
  onChange?: OnValue<string> | undefined;
  placeholder?: string | undefined;
  loading?: boolean | undefined;
  policy?: { name?: string | undefined; version: string; effective: string } | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function Select(p: SelectProps) {
  const id = useUid("r1-sel");
  const sv = useSynced(isNil(p.value) ? "" : p.value, "");
  const t = tx(p.locale);
  const opts = p.options || [];
  // A width given by the screen is at least as wide as the longest option (in ch, with the box's padding and chevron),
  // so choosing it never cuts its name; 100% of the column still caps it.
  const longest = Math.max(p.placeholder ? p.placeholder.length : 0, ...opts.map((o) => o.label.length));
  const given = typeof p.width === "number" ? p.width + "px" : p.width;
  const width = given && longest > 0 ? "max(" + given + ", calc(" + longest + "ch + var(--space-12)))" : given;
  let current = null;
  for (let i = 0; i < opts.length; i++) if (opts[i]!.value === p.value) current = opts[i];
  let control;
  if (p.readOnly) {
    control = readOnlyBox(p, id, current ? current.label : "–");
  } else if (p.loading) {
    // While the options load, the field says so in words and cannot be opened; nothing is chosen on the reader's behalf.
    control = (
      <div className="r1-select r1-select--loading">
        <select
          id={id}
          name={p.name}
          className="r1-input r1-select__native"
          disabled={true}
          aria-busy="true"
          aria-describedby={describedBy(p, id)}
        >
          <option value="">{t.loading}</option>
        </select>
        <Icon name="loader-circle" size={fieldIconSize(p)} spin={true} className="r1-select__chev" />
      </div>
    );
  } else {
    control = (
      <div className="r1-select">
        <select
          id={id}
          name={p.name}
          className="r1-input r1-select__native"
          value={sv[0]}
          disabled={p.disabled}
          required={p.required}
          aria-invalid={p.error ? "true" : undefined}
          aria-describedby={describedBy(p, id)}
          onBlur={p.onBlur}
          onChange={function (e) {
            sv[1](e.target.value);
            if (p.onChange) p.onChange(e.target.value, e);
          }}
        >
          {p.placeholder ? <option value="">{p.placeholder}</option> : null}
          {opts.map(function (o) {
            return (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            );
          })}
        </select>
        <Icon name="chevron-down" size={fieldIconSize(p)} className="r1-select__chev" />
      </div>
    );
  }
  const policy = p.policy ? (
    <div className="r1-field__policy">
      <Icon name="scale" size={16} />
      <span>
        {(p.policy.name ? p.policy.name + ", " + t.legal.version.toLowerCase() : t.legal.version) +
          " " +
          p.policy.version +
          ", " +
          t.policyFrom +
          " " +
          (formatDate(p.policy.effective, p.locale) || p.policy.effective)}
      </span>
    </div>
  ) : null;
  return fieldShell(
    sizedField({ ...p, width }),
    id,
    <div className="r1-field__control" style={width ? { maxWidth: width } : undefined}>
      {control}
    </div>,
    policy,
  );
}

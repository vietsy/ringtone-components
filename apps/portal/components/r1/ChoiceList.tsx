"use client";

import type * as React from "react";
import { FieldMessage } from "./FieldMessage";
import { Icon } from "./Icon";
import { StatusIcon } from "./StatusIcon";
import { choiceMark } from "./lib/choice-controls";
import { fieldShell, readOnlyBox } from "./lib/form-parts";
import { cx, isNil, useSynced, useUid } from "./lib/helpers";
import { STATUS_FAMILIES } from "./lib/icons";
import { tx } from "./lib/strings";
import type { ChoiceOption, Locale } from "./lib/types";

export type ChoiceListProps = {
  legend?: string | undefined;
  helper?: string | undefined;
  required?: boolean | undefined;
  options: ChoiceOption[];
  value?: string | string[] | undefined;
  multiple?: boolean | undefined;
  layout?: "list" | "inline" | "cards" | "chips" | undefined;
  density?: "console" | "portal" | "premises" | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  readOnly?: boolean | undefined;
  name?: string | undefined;
  onChange?: ((e: unknown) => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// One choice from a short list (radios), or several with multiple (checkboxes). Five or more options: use Select.
// The chosen options are the list's own state, reset whenever the page passes a new value, so chips and cards
// show the reader's pick. Each input carries aria-invalid and its own hint and reason; the group carries the
// helper and the error. readOnly shows the chosen labels as a value named by the legend.
export function ChoiceList(p: ChoiceListProps) {
  const t = tx(p.locale);
  const id = useUid("r1-cl");
  const multiple = !!p.multiple;
  const opts = p.options || [];
  const st = useSynced<string | string[] | null>(
    multiple ? JSON.stringify(p.value || []) : p.value,
    multiple ? "[]" : null,
  );
  // With multiple the state is always the JSON of the chosen values.
  const chosen: (string | string[] | null)[] = multiple
    ? (JSON.parse((st[0] || "[]") as string) as string[])
    : [st[0]];
  if (p.readOnly) {
    const picked = opts
      .filter(function (o) {
        return chosen.indexOf(o.value) >= 0;
      })
      .map(function (o) {
        return o.label;
      });
    const shown = Object.assign({}, p, {
      label: p.legend,
      readOnly: true,
      error: undefined,
      warning: undefined,
      info: undefined,
      density: p.density || "console",
    });
    return fieldShell(
      shown,
      id,
      <div className="r1-field__control">{readOnlyBox(shown, id, picked.length ? picked.join(", ") : "–")}</div>,
    );
  }
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (multiple) {
      const next = opts
        .map(function (o) {
          return o.value;
        })
        .filter(function (x) {
          return x === v ? e.target.checked : chosen.indexOf(x) >= 0;
        });
      st[1](JSON.stringify(next));
    } else st[1](v);
    if (p.onChange) p.onChange(e);
  }
  return (
    <fieldset
      className={cx(
        "r1-choices",
        "r1-choices--" + (p.density || "console"),
        p.layout && p.layout !== "list" && "r1-choices--" + p.layout,
        p.error && "r1-choices--error",
        p.className,
      )}
      aria-describedby={
        [p.helper && id + "-help", p.error && id + "-msg", p.disabled && p.disabledReason && id + "-why"]
          .filter(Boolean)
          .join(" ") || undefined
      }
      style={p.style}
    >
      {p.legend ? (
        <legend className="r1-choices__legend">
          {p.legend}
          {p.required ? <span className="r1-field__req">{t.required}</span> : null}
        </legend>
      ) : null}
      {p.helper ? (
        <p id={id + "-help"} className="r1-field__help">
          {p.helper}
        </p>
      ) : null}
      <div className="r1-choices__list">
        {opts.map(function (o, i) {
          const oid = id + "-" + i;
          const on = chosen.indexOf(o.value) >= 0;
          const off = o.disabled || p.disabled;
          const why = off && o.reason;
          const oh = isNil(o.helper) ? o.hint : o.helper;
          // family: the option is a state (Đạt, Không đạt, Cần bổ sung): its status shape leads the label in the family's
          // colour, and once chosen a card or a chip takes the family's tint and edge in place of the accent.
          const fam = (STATUS_FAMILIES as readonly (string | undefined)[]).indexOf(o.family) >= 0 ? o.family : null;
          return (
            <label
              key={o.value}
              htmlFor={oid}
              className={cx(
                "r1-choice",
                on && "r1-choice--on",
                off && "r1-choice--disabled",
                fam && "r1-choice--fam r1-choice--" + fam,
              )}
            >
              {choiceMark(multiple ? "checkbox" : "radio", {
                id: oid,
                name: p.name || id,
                value: o.value,
                checked: on,
                disabled: off,
                onChange: pick,
                "aria-invalid": p.error ? "true" : undefined,
                "aria-describedby": [oh && oid + "-hint", why && oid + "-why"].filter(Boolean).join(" ") || undefined,
              })}
              <span className="r1-check__text">
                <span className="r1-check__label">
                  {fam ? (
                    <StatusIcon
                      family={fam}
                      size={16}
                      cutout={on && (p.layout === "cards" || p.layout === "chips") ? fam + "-tint" : "surface"}
                      className="r1-choice__shape"
                    />
                  ) : null}
                  {o.label}
                </span>
                {oh ? (
                  <span id={oid + "-hint"} className="r1-check__hint">
                    {oh}
                  </span>
                ) : null}
                {why ? (
                  <span id={oid + "-why"} className="r1-check__hint">
                    {o.reason}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
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
    </fieldset>
  );
}

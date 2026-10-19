"use client";

import type * as React from "react";
import { useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { affixName, describedBy, fieldIconSize, fieldShell, readOnlyBox, sizedField } from "./lib/form-parts";
import { announce, cx, isNil, textOf, useSynced, useUid } from "./lib/helpers";
import { ICONS } from "./lib/icons";
import { tx } from "./lib/strings";
import type { Strings } from "./lib/strings";
import { idChars, maskValue } from "./lib/value-atoms";
import type { FieldBase, OnValue } from "./lib/types";

// masked: a stored secret value (a webhook signing secret, an account number) shown masked. Read-only, every character
// but the last four is a dot, a screen reader hears "value ending in 4F2K", and revealable adds Show / Hide. Editable,
// the input hides what is typed (type password, autocomplete off) and revealable adds the same toggle. Copying and
// submitting always carry the whole value.
function maskToggle(p: TextFieldProps, shown: boolean, setShown: (shown: boolean) => void, mt: Strings["valueMask"]) {
  if (!p.revealable) return null;
  return (
    <Button
      variant="quiet"
      size={p.density === "console" ? "sm" : "md"}
      icon={shown ? "eye-off" : "eye"}
      className="r1-tf__reveal"
      ariaLabel={(shown ? mt.hideName : mt.showName) + ": " + textOf(p.label)}
      onClick={function () {
        announce(shown ? mt.hidden : mt.shown);
        setShown(!shown);
      }}
      locale={p.locale}
    >
      {shown ? mt.hide : mt.show}
    </Button>
  );
}

export type TextFieldProps = FieldBase & {
  value?: string | undefined;
  onChange?: OnValue<string> | undefined;
  placeholder?: string | undefined;
  prefix?: string | undefined;
  suffix?: string | undefined;
  mono?: boolean | undefined;
  multiline?: boolean | undefined;
  wrap?: boolean | undefined;
  rows?: number | undefined;
  type?: string | undefined;
  inputMode?: string | undefined;
  autoComplete?: string | undefined;
  maxLength?: number | undefined;
  /** a stored secret value shown masked: read-only, dots but the last four ("value ending in 4F2K" to a screen reader); editable, the input hides what is typed. One line, monospace */ masked?:
    boolean | undefined;
  /** with masked: a Show / Hide control beside the value */ revealable?: boolean | undefined;
  /** an Icon name drawn at the start of the input, as SearchField draws its magnifier (Figma Field/Input "Leading icon"). Decoration only: the label still names the input. Drawn on a one-line editable input; ignored when read-only, multiline, wrapping or masked and beside a prefix or a unit, which Figma does not draw. An unknown name draws nothing */ icon?:
    string | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function TextField(p: TextFieldProps) {
  const id = useUid("r1-tf");
  const st = useSynced(isNil(p.value) ? "" : String(p.value), "");
  const reveal = useState(false);
  const mt = tx(p.locale).valueMask;
  const hiding = !!p.masked && !reveal[0];
  let control;
  if (p.readOnly) {
    const rv = isNil(p.value) || p.value === "" ? null : String(p.value);
    const bare = rv ? idChars(rv) : "";
    // multiline: a long value with no spaces (a JSON public key) breaks anywhere when it must, never widening the page.
    control = readOnlyBox(
      p,
      id,
      !rv
        ? "–"
        : hiding
          ? [
              <span key="m" aria-hidden="true">
                {maskValue(rv)}
              </span>,
              <span key="s" className="r1-sr">
                {bare.length > 4 ? mt.ending.replace("{tail}", bare.slice(-4)) : mt.hiddenValue}
              </span>,
            ]
          : [p.prefix ? p.prefix + " " : null, rv, p.suffix ? " " + p.suffix : null],
      cx((p.mono || p.masked) && "r1-mono", p.multiline && !p.masked && "r1-readonly--multiline"),
    );
    if (p.masked && rv)
      control = (
        <div className="r1-tf__masked">
          {control}
          {maskToggle(p, reveal[0], reveal[1], mt)}
        </div>
      );
  } else {
    const attrs = {
      id: id,
      name: p.name,
      className: cx("r1-input", (p.mono || p.masked) && "r1-mono"),
      value: st[0],
      placeholder: p.placeholder,
      disabled: p.disabled,
      required: p.required,
      autoComplete: p.masked ? p.autoComplete || "off" : p.autoComplete,
      maxLength: p.maxLength,
      "aria-invalid": p.error ? ("true" as const) : undefined,
      "aria-describedby": describedBy(p, id),
      "aria-labelledby": p.prefix || p.suffix ? affixName(id, p.prefix, p.suffix) : undefined,
      inputMode: p.inputMode as React.HTMLAttributes<HTMLElement>["inputMode"],
      onBlur: p.onBlur,
      onChange: function (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        st[1](e.target.value);
        if (p.onChange) p.onChange(e.target.value, e);
      },
    };
    const lead =
      p.icon && !p.multiline && !p.wrap && !p.prefix && !p.suffix && (ICONS as Record<string, unknown>)[p.icon]
        ? p.icon
        : null;
    // wrap: a one-line value shown in full over as many lines as it needs (a long legal name on a phone). Enter adds no line.
    const input = p.masked ? (
      <input type={hiding ? "password" : "text"} spellCheck={false} autoCapitalize="off" {...attrs} />
    ) : p.multiline ? (
      <textarea rows={p.rows || 3} {...attrs} />
    ) : p.wrap ? (
      <textarea
        {...attrs}
        {...{
          rows: p.rows || 1,
          className: cx("r1-input", "r1-input--wrap", p.mono && "r1-mono"),
          enterKeyHint: "next",
          onKeyDown: function (e) {
            if (e.key === "Enter") e.preventDefault();
          },
        }}
      />
    ) : lead ? (
      // The icon sits over the input's padding, as SearchField's does, so the input keeps its own box, label and states.
      <div className="r1-tf__lead">
        <Icon name={lead} size={fieldIconSize(p)} className="r1-tf__icon" />
        <input type={p.type || "text"} {...attrs} />
      </div>
    ) : (
      <input type={p.type || "text"} {...attrs} />
    );
    control =
      p.suffix || p.prefix ? (
        <div className="r1-affix">
          {p.prefix ? (
            <span id={id + "-pre"} className="r1-affix__part">
              {p.prefix}
            </span>
          ) : null}
          {input}
          {p.suffix ? (
            <span id={id + "-suf"} className="r1-affix__part">
              {p.suffix}
            </span>
          ) : null}
        </div>
      ) : (
        input
      );
    if (p.masked)
      control = (
        <div className="r1-tf__masked">
          {control}
          {maskToggle(p, reveal[0], reveal[1], mt)}
        </div>
      );
  }
  return fieldShell(
    sizedField(p),
    id,
    <div className="r1-field__control" style={p.width ? { maxWidth: p.width } : undefined}>
      {control}
    </div>,
  );
}

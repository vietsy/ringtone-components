"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import { FieldMessage } from "./FieldMessage";
import { Icon } from "./Icon";
import { announce, cx, isNil, readerActed, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type SwitchProps = {
  label: string;
  helper?: string | undefined;
  hint?: string | undefined;
  checked?: boolean | undefined;
  onChange?: ((on: boolean) => void) | undefined;
  loading?: boolean | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  density?: "console" | "portal" | "premises" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A setting that takes effect the moment it is switched. A choice saved with a form is a Checkbox.
// loading: the change is being saved; the switch holds, a line under it says "Đang lưu", and clicks wait. error: the change
// did not save; the page puts the switch back and the message says what to do. A disabled switch reads as
// disabled whether it is on or off: a pale track, a grey knob on its side, and the word.
export function Switch(p: SwitchProps) {
  const t = tx(p.locale);
  const id = useUid("r1-sw");
  const st = useState(!!p.checked);
  const on = p.onChange ? !!p.checked : st[0];
  const off = !!p.disabled;
  const busy = !!p.loading && !off;
  useEffect(
    function () {
      if (busy && readerActed()) announce(t.sw.saving, "polite");
    },
    [busy],
  );
  const help = isNil(p.helper) ? p.hint : p.helper;
  const ids =
    [help && id + "-hint", p.error && id + "-msg", off && p.disabledReason && id + "-why"].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div
      className={cx(
        "r1-switch",
        "r1-switch--" + (p.density || "portal"),
        off && "r1-switch--disabled",
        busy && "r1-switch--busy",
        p.error && "r1-switch--error",
        p.className,
      )}
      style={p.style}
    >
      <div className="r1-switch__row">
        <span className="r1-switch__text">
          <label className="r1-switch__label" htmlFor={id}>
            {p.label}
          </label>
          {help ? (
            <span id={id + "-hint"} className="r1-switch__hint">
              {help}
            </span>
          ) : null}
        </span>
        <button
          id={id}
          type="button"
          role="switch"
          className="r1-switch__control"
          aria-checked={on ? "true" : "false"}
          aria-describedby={ids}
          aria-busy={busy ? "true" : undefined}
          aria-disabled={busy ? "true" : undefined}
          disabled={off}
          onClick={function () {
            if (busy) return;
            if (p.onChange) p.onChange(!on);
            else st[1](!on);
          }}
        >
          <span className="r1-switch__track" aria-hidden="true">
            <span className="r1-switch__knob" />
          </span>
          <span className="r1-switch__state" aria-hidden="true">
            {on ? t.sw.on : t.sw.off}
          </span>
        </button>
      </div>
      {busy ? (
        <p className="r1-switch__busy">
          <Icon name="loader-circle" size={16} spin={true} />
          <span>{t.sw.saving}</span>
        </p>
      ) : null}
      {p.error ? (
        <FieldMessage id={id + "-msg"} severity="error" locale={p.locale}>
          {p.error}
        </FieldMessage>
      ) : null}
      {off && p.disabledReason ? (
        <div id={id + "-why"} className="r1-field__reason">
          <Icon name="info" size={16} />
          <span>{p.disabledReason}</span>
        </div>
      ) : null}
    </div>
  );
}

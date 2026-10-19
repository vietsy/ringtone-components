"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { FieldMessage } from "./FieldMessage";
import { announce, cx, focusEl, focusables, isNil, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type FieldRowsProps = {
  legend: string;
  helper?: string | undefined;
  required?: boolean | undefined;
  max?: number | undefined;
  count?: number | undefined;
  addLabel?: string | undefined;
  /** receives the Add button's click event */ onAdd?: ((e: unknown) => void) | undefined;
  error?: string | undefined;
  density?: "console" | "portal" | "premises" | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A group of rows the reader adds to and removes from. Each FieldRow names itself, so "Xoá" says which row.
// After the reader adds a row, focus goes to its first field; after a remove, to the add button. Both are said.
export function FieldRows(p: FieldRowsProps) {
  const t = tx(p.locale);
  const id = useUid("r1-rows");
  const root = useRef<HTMLFieldSetElement>(null);
  const acted = useRef<"remove" | "add" | null>(null);
  // count: how many rows there are, when the rows are rendered by a template and cannot be counted here
  const n = isNil(p.count) ? React.Children.toArray(p.children).length : p.count;
  const before = useRef(n);
  useEffect(
    function () {
      const was = before.current,
        why = acted.current;
      before.current = n;
      acted.current = null;
      if (!root.current || !why || n === was) return;
      if (n > was) {
        const rows = root.current.querySelectorAll(".r1-rows__list .r1-frow");
        const last = rows[rows.length - 1];
        if (!last) return;
        focusEl(focusables(last.querySelector(".r1-frow__fields"))[0]);
        const title = last.querySelector(".r1-frow__title");
        announce(t.rows.added.replace("{title}", title ? title.textContent : ""), "polite");
      } else {
        focusEl(focusables(root.current.querySelector(".r1-rows__foot"))[0]);
        announce(t.rows.removed.replace("{n}", String(n)), "polite");
      }
    },
    [n],
  );
  const full = p.max && n >= p.max;
  const size = p.density === "console" ? "sm" : "md";
  return (
    <fieldset
      ref={root}
      className={cx("r1-rows", "r1-rows--" + (p.density || "portal"), p.error && "r1-rows--error", p.className)}
      style={p.style}
      aria-describedby={[p.helper && id + "-help", p.error && id + "-msg"].filter(Boolean).join(" ") || undefined}
    >
      <legend className="r1-rows__legend">
        {p.legend}
        {p.required ? <span className="r1-field__req">{t.required}</span> : null}
      </legend>
      {p.helper ? (
        <p id={id + "-help"} className="r1-field__help">
          {p.helper}
        </p>
      ) : null}
      <div
        className="r1-rows__list"
        onClickCapture={function (e) {
          if ((e.target as Element).closest && (e.target as Element).closest(".r1-frow__head .r1-btn"))
            acted.current = "remove";
        }}
      >
        {p.children}
      </div>
      <div className="r1-rows__foot">
        <Button
          variant="secondary"
          size={size}
          icon="plus"
          disabled={!!full}
          disabledReason={full ? t.rows.max.replace("{n}", String(p.max)) : undefined}
          onClick={function (e) {
            acted.current = "add";
            if (p.onAdd) p.onAdd(e);
          }}
          locale={p.locale}
        >
          {p.addLabel || t.rows.add}
        </Button>
        {p.max && !full ? (
          <span className="r1-rows__count">
            {t.rows.count.replace("{n}", String(n)).replace("{max}", String(p.max))}
          </span>
        ) : null}
      </div>
      {p.error ? (
        <FieldMessage id={id + "-msg"} severity="error" locale={p.locale}>
          {p.error}
        </FieldMessage>
      ) : null}
    </fieldset>
  );
}

"use client";

import type * as React from "react";
import { FieldMessage } from "../FieldMessage";
import { Icon } from "../Icon";
import { ProvenanceChip } from "../ProvenanceChip";
import { cx } from "./helpers";
import { tx } from "./strings";
import type { FieldBase, Locale, Provenance } from "./types";

/** What the field frame reads from a field's props (a FieldBase field, or a ChoiceList drawn read-only). */
export type FieldShellProps = {
  label?: React.ReactNode;
  /** false: no helper line (DateField, TimeField) */ helper?: React.ReactNode;
  hideLabel?: boolean | undefined;
  required?: boolean | undefined;
  error?: string | undefined;
  warning?: string | undefined;
  acknowledged?: boolean | undefined;
  onAcknowledge?: (() => void) | undefined;
  info?: string | undefined;
  readOnly?: boolean | undefined;
  provenance?: Provenance | undefined;
  provenanceDetail?: string | undefined;
  provenanceWords?: "plain" | "default" | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  density?: FieldBase["density"];
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  locale?: Locale | undefined;
};

export function fieldShell(
  p: FieldShellProps,
  inputId: string,
  control: React.ReactNode,
  extra?: React.ReactNode,
): React.ReactElement {
  const t = tx(p.locale);
  const helpId = inputId + "-help";
  const msgId = inputId + "-msg";
  return (
    <div
      className={cx(
        "r1-field",
        // r1-field--rows: label, help and body, the three rows Columns lines up across two fields (r1.css).
        "r1-field--rows",
        "r1-field--" + (p.density || "portal"),
        p.readOnly && "r1-field--readonly",
        p.error && "r1-field--error",
        p.className,
      )}
      style={p.style}
    >
      {
        // hideLabel keeps the label for screen readers only, when a heading beside the field already says what it is.
        p.hideLabel ? (
          <label id={inputId + "-label"} className="r1-sr" htmlFor={inputId}>
            {p.label}
          </label>
        ) : (
          <div className="r1-field__head">
            <label id={inputId + "-label"} className="r1-field__label" htmlFor={inputId}>
              {p.label}
            </label>
            {p.required && !p.readOnly ? <span className="r1-field__req">{t.required}</span> : null}
            {p.provenance ? (
              <ProvenanceChip
                kind={p.provenance}
                detail={p.provenanceDetail}
                words={p.provenanceWords}
                locale={p.locale}
              />
            ) : null}
          </div>
        )
      }
      {p.helper ? (
        <div id={helpId} className="r1-field__help">
          {p.helper}
        </div>
      ) : null}
      <div className="r1-field__body">
        {
          // The box and what is said under it. display: contents, so the field lays them out as before; in Columns
          // it is a row of its own, so two fields side by side start their boxes on one line.
        }
        {control}
        {extra || null}
        {p.error ? (
          <FieldMessage id={msgId} severity="error" locale={p.locale}>
            {p.error}
          </FieldMessage>
        ) : null}
        {!p.error && p.warning ? (
          <FieldMessage
            id={msgId}
            severity="warning"
            acknowledgeable={true}
            acknowledged={p.acknowledged}
            onAcknowledge={p.onAcknowledge}
            locale={p.locale}
          >
            {p.warning}
          </FieldMessage>
        ) : null}
        {!p.error && !p.warning && p.info ? (
          <FieldMessage id={msgId} severity="info" locale={p.locale}>
            {p.info}
          </FieldMessage>
        ) : null}
        {p.disabled && p.disabledReason ? (
          <div id={inputId + "-why"} className="r1-field__reason">
            <Icon name="info" size={16} />
            <span>{p.disabledReason}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function describedBy(p: FieldShellProps, id: string): string | undefined {
  const ids: string[] = [];
  if (p.helper) ids.push(id + "-help");
  if (p.error || p.warning || p.info) ids.push(id + "-msg");
  if (p.disabled && p.disabledReason) ids.push(id + "-why");
  return ids.length ? ids.join(" ") : undefined;
}

// A value the reader may read but not change: named by the field's label, reachable by Tab.
// A <label for> cannot name a div, so the name comes through aria-labelledby.
export function readOnlyBox(
  p: FieldShellProps,
  id: string,
  content: React.ReactNode,
  cls?: string | null,
  moreIds?: string | null,
): React.ReactElement {
  return (
    <div
      id={id}
      className={cx("r1-readonly", cls)}
      role="textbox"
      aria-readonly="true"
      tabIndex={0}
      aria-labelledby={id + "-label"}
      aria-describedby={[describedBy(p, id), moreIds].filter(Boolean).join(" ") || undefined}
    >
      {content}
    </div>
  );
}

// Field icons follow the field: 16 px in the console (text-sm), 20 px on the portals and the premises portal.
export function fieldIconSize(p: FieldShellProps): number {
  return p.density === "console" ? 16 : 20;
}

// A prefix or a unit is part of what the value means, so it joins the label in the input's name:
// "Offline playback limit hours", "Adjustment VND".
// pre, suf: the prefix and the unit, or whether the field has one.
export function affixName(
  id: string,
  pre: string | boolean | null | undefined,
  suf: string | boolean | null | undefined,
): string {
  return [id + "-label", pre ? id + "-pre" : null, suf ? id + "-suf" : null].filter(Boolean).join(" ");
}

// width on a Select, a Combobox, a TextField or a SearchField: a cap in a column, as on every field, and the field's own
// width inside a FilterBar, where the fields sit in a row and would otherwise shrink to the box's default width and cut
// the chosen name or the placeholder. The
// field carries the width as --r1-field-width and the r1-field--sized class; only the FilterBar's rule reads them.
export function sizedField<
  P extends { width?: number | string | undefined; className?: string | undefined; style?: React.CSSProperties | undefined },
>(p: P): P {
  if (!p.width) return p;
  return Object.assign({}, p, {
    className: cx("r1-field--sized", p.className),
    style: Object.assign({ "--r1-field-width": p.width }, p.style),
  });
}

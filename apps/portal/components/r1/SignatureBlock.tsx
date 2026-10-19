"use client";

import type * as React from "react";
import { Button } from "./Button";
import { FieldMessage } from "./FieldMessage";
import { StatusIcon } from "./StatusIcon";
import { formatTimestamp } from "./lib/formatting";
import { cx, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale, OnValue } from "./lib/types";

// Names match however they were typed: Unicode composed or decomposed, spacing and letter case.
function sameName(a: string, b: string): boolean {
  function norm(s: string): string {
    return String(s || "")
      .normalize("NFC")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("vi");
  }
  return norm(a) !== "" && norm(a) === norm(b);
}

export type SignatureBlockProps = {
  legalName: string;
  typedName?: string | undefined;
  scrolledToEnd?: boolean | undefined;
  signLabel?: string | undefined;
  name?: string | undefined;
  onType?: OnValue<string> | undefined;
  onSign?: (() => void) | undefined;
  /** the signature is being sent: the name is held and Sign is busy */ loading?: boolean | undefined;
  /** signed: the name stays, Sign goes, and the line says when */ signed?: boolean | undefined;
  signedAt?: string | undefined;
  /** why signing failed and what to do, under the button */ error?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function SignatureBlock(p: SignatureBlockProps) {
  const t = tx(p.locale);
  const id = useUid("r1-sig");
  const typedSt = useSynced(p.typedName, "");
  const nameOk = sameName(typedSt[0], p.legalName);
  const remaining: string[] = [];
  if (!p.scrolledToEnd) remaining.push(t.sign.mustScroll);
  if (!nameOk) remaining.push(t.sign.mustType);
  const ready = remaining.length === 0;
  // Signed: the name stays as it was signed and the button goes, so nothing can be signed twice.
  // loading: the signature is on its way; the name is held and the button says it is busy.
  const locked = !!(p.signed || p.loading);
  const state = p.signed ? (
    <p className="r1-sign__state r1-positive-text" role="status">
      <StatusIcon family="positive" size={16} />
      {p.signedAt ? t.sign.signed.replace("{t}", String(formatTimestamp(p.signedAt, p.locale))) : t.sign.signedDone}
    </p>
  ) : ready ? (
    <p className="r1-sign__state r1-positive-text" role="status">
      <StatusIcon family="positive" size={16} />
      {t.sign.ready}
    </p>
  ) : (
    <div id={id + "-left"} className="r1-sign__state">
      <p>{t.sign.remaining}</p>
      <ul>
        {remaining.map(function (r, i) {
          return <li key={i}>{r}</li>;
        })}
      </ul>
    </div>
  );
  return (
    <section className={cx("r1-sign", p.signed && "r1-sign--signed", p.className)} style={p.style}>
      <div className="r1-field">
        <label className="r1-field__label" htmlFor={id}>
          {t.sign.typeName}
        </label>
        <input
          id={id}
          name={p.name}
          className="r1-input"
          value={typedSt[0]}
          autoComplete="name"
          readOnly={locked}
          aria-describedby={!ready && !locked ? id + "-left" : undefined}
          onChange={function (e) {
            if (locked) return;
            typedSt[1](e.target.value);
            if (p.onType) p.onType(e.target.value, e);
          }}
        />
      </div>
      {state}
      {p.signed ? null : (
        <Button
          variant="primary"
          size="lg"
          disabled={!ready}
          loading={!!p.loading}
          aria-describedby={ready ? undefined : id + "-left"}
          onClick={p.onSign}
          locale={p.locale}
        >
          {p.signLabel || t.sign.sign}
        </Button>
      )}
      {p.error && !p.signed ? (
        <FieldMessage severity="error" locale={p.locale}>
          {p.error}
        </FieldMessage>
      ) : null}
    </section>
  );
}

"use client";

import type * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { FactList } from "./FactList";
import { QrCode } from "./QrCode";
import { StatusIcon } from "./StatusIcon";
import { formatTimestamp } from "./lib/formatting";
import { cx, isNil, nounText } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { CellKind, Family, Locale } from "./lib/types";

// A record laid out on an A4 sheet for printing and PDF, black on white only (Layout §7): the legal name of the
// record, the issuer, the reference, the facts, and the verification route beside a code at least 30 mm wide.
// variant 'entitlement' is the Player service entitlement: a visibly different layout and heading (C-UI-09).
// The address a printed code opens: the route as printed, with https:// in front when it has no scheme.
function verifyHref(u: string | undefined): string | null {
  return !u ? null : /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : "https://" + u;
}

// The printed route never breaks inside its reference: a route too long for its column breaks after its last slash
// ("rightone.vn/v/" then "R1-CER-2026-T7QM4BWJ"), never at a hyphen of the reference.
function routeText(u: string) {
  const s = String(u),
    at = s.lastIndexOf("/");
  if (at < 0 || at === s.length - 1) return s;
  return [
    s.slice(0, at + 1),
    <wbr key="w" />,
    <span key="r" className="r1-nowrap">
      {s.slice(at + 1)}
    </span>,
  ];
}

export type PrintableRecordProps = {
  variant?: "record" | "entitlement" | undefined;
  /** a preview narrower than the sheet (a phone): on screen the sheet takes the column's width; printed it is A4 */ fit?:
    boolean | undefined;
  title: string;
  /** 2 when the sheet is a preview inside a page that already has its h1; default 1, the sheet is the page */ titleLevel?:
    1 | 2 | undefined;
  subtitle?: string | undefined;
  /** family: the entitlement's state shape (the record always shows the seal) */ status?:
    | {
        label: string;
        family?: Family | undefined;
      }
    | undefined;
  /** the instant the printed status was true (ISO 8601), written after the status words in the shared timestamp format: "…, lúc 19 thg 9, 2026, 08:30 (GMT+7)" */ statusAt?:
    string | undefined;
  /** the caveat printed under the status: "Tình trạng có thể đã thay đổi. Quét mã để xem tình trạng hiện tại." */ statusNote?:
    string | undefined;
  /** after-facts (a status record): the status block follows the facts, before the code; default after-title */ statusPlacement?:
    "after-title" | "after-facts" | undefined;
  /** short lines printed with the code, under its reference, values in monospace: the printout reference, the signing key */ codeLines?:
    | {
        label?: string | undefined;
        value: string;
      }[]
    | undefined;
  recordId?: string | undefined;
  issuer: string;
  issued?: string | undefined;
  facts?: { label: string; value: unknown; kind?: CellKind | undefined }[] | undefined;
  /** the printed route; the code is made from it (https:// added when it has no scheme) */ verifyUrl?:
    string | undefined;
  /** the code's modules, only to override the code made from verifyUrl */ qr?: string[] | undefined;
  /** counted from the laid-out sheet unless passed */ page?: number | undefined;
  pages?: number | undefined;
  /** the record's noun in the reference and verification lines ("giấy xác nhận" / "status record"); without it they name no document type. The entitlement keeps its own words */ recordNoun?:
    string | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function PrintableRecord(p: PrintableRecordProps) {
  const t = tx(p.locale).print;
  const ent = p.variant === "entitlement";
  // The sheets are counted from the laid-out record: its height over one A4 sheet, margins taken off both.
  // page and pages, when passed, still win (a sheet that is part of a longer print run).
  const sheetRef = useRef<HTMLElement>(null);
  const counted = useState(1);
  useLayoutEffect(function () {
    const el = sheetRef.current;
    if (!el || typeof getComputedStyle === "undefined") return;
    const cs = getComputedStyle(el),
      sheet = parseFloat(cs.minHeight) || 0,
      pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const n = sheet > pad ? Math.max(1, Math.ceil((el.scrollHeight - pad - 1) / (sheet - pad))) : 1;
    if (n !== counted[0]) counted[1](n);
  });
  const pages = p.pages || counted[0],
    page = p.page || pages;
  const href = verifyHref(p.verifyUrl);
  // The entitlement never borrows the status record's words: its ID is a reference and the sheet is a document.
  // recordNoun names the record in the reference and the verification line ("Mã giấy xác nhận", "Kiểm tra giấy xác
  // nhận này tại"); without it the sheet names no document type ("Mã tham chiếu", "Kiểm tra mã này tại").
  const noun = !ent && p.recordNoun ? String(p.recordNoun) : null;
  const refLabel = ent ? t.refEnt : nounText(t.ref, t.refNoun, noun),
    verifyLabel = ent ? t.verifyEnt : nounText(t.verify, t.verifyNoun, noun);
  // The code is made from the verification route unless the page passes its modules.
  // codeLines ([{label, value}]): short lines printed with the code, under the reference (the printout reference, the
  // signing key), each value in monospace, so a failed scan can still be checked by hand.
  const lines = (p.codeLines || []).filter(function (l) {
    return l && !isNil(l.value) && l.value !== "";
  });
  const hasCode = !!(p.qr || href);
  const code =
    hasCode || lines.length ? (
      <div className="r1-print__code">
        {hasCode ? (
          <QrCode
            modules={p.qr}
            value={p.qr ? undefined : href!}
            size={160}
            quiet={4}
            label={verifyLabel + " " + (p.verifyUrl || "")}
            locale={p.locale}
          />
        ) : null}
        {hasCode && p.recordId ? <span className="r1-mono r1-print__code-id">{p.recordId}</span> : null}
        {lines.length ? (
          <dl className="r1-print__code-lines">
            {lines.map(function (l, i) {
              return (
                <div key={i} className="r1-print__code-line">
                  {l.label ? <dt>{l.label}</dt> : null}
                  <dd className="r1-mono">{l.value}</dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>
    ) : null;
  const verify = (
    <div className="r1-print__verify">
      {p.verifyUrl ? <span>{verifyLabel}</span> : null}
      {p.verifyUrl ? <span className="r1-mono r1-print__url">{routeText(p.verifyUrl)}</span> : null}
      {p.issued ? <span>{t.issued + " " + formatTimestamp(p.issued, p.locale)}</span> : null}
    </div>
  );
  // statusAt: the instant the printed status was true, after the status words in the shared timestamp format
  // ("…: Đang có hiệu lực, lúc 19 thg 9, 2026, 08:30 (GMT+7)"); the instant keeps to one line. statusNote: the caveat
  // printed under it ("Tình trạng có thể đã thay đổi. …"). With either, the status is a block of the two.
  const at = p.status && p.statusAt ? formatTimestamp(p.statusAt, p.locale) : null;
  const pill = p.status ? (
    <p className={cx("r1-print__status", ent && "r1-print__status--rect", at && "r1-print__status--at")}>
      <StatusIcon family={ent ? p.status.family || "neutral" : "seal"} size={24} cutout="code-paper" />
      {at ? (
        <span>
          {p.status.label + ", "}
          <span className="r1-print__status-at">{t.statusAt + " " + at}</span>
        </span>
      ) : (
        <span>{p.status.label}</span>
      )}
    </p>
  ) : null;
  const status =
    at || p.statusNote ? (
      <div className="r1-print__statusblock">
        {pill}
        {p.statusNote ? <p className="r1-print__status-note">{p.statusNote}</p> : null}
      </div>
    ) : (
      pill
    );
  // statusPlacement 'after-facts' (a status record): the status block follows the facts, before the code, as the
  // record's reading order has it (title, reference and issuer, premises, period and scope, status, code).
  const late = !ent && p.statusPlacement === "after-facts";
  const facts = p.facts ? <FactList items={p.facts} columns={ent ? 1 : 2} locale={p.locale} /> : null;
  const head = (
    <header className="r1-print__head">
      <span className="r1-print__issuer">{p.issuer}</span>
      {p.recordId ? (
        <span className="r1-print__ref">
          <span>{refLabel}</span>
          <span className="r1-mono">{p.recordId}</span>
        </span>
      ) : null}
    </header>
  );
  const titles = (
    <div className="r1-print__titles">
      {p.titleLevel === 2 ? <h2 className="r1-print__title">{p.title}</h2> : <h1 className="r1-print__title">{p.title}</h1>}
      {p.subtitle ? <p className="r1-print__subtitle">{p.subtitle}</p> : null}
    </div>
  );
  const pageNo = <span className="r1-print__page r1-num">{t.page + " " + page + "/" + pages}</span>;
  if (ent) {
    return (
      <article
        ref={sheetRef}
        className={cx("r1-print r1-print--entitlement", p.fit && "r1-print--fit", p.className)}
        style={p.style}
        data-theme="light"
      >
        {head}
        <div className="r1-print__band">
          <div className="r1-print__band-text">
            {titles}
            {status}
          </div>
          {code}
        </div>
        {facts}
        {p.children ? <div className="r1-print__body">{p.children}</div> : null}
        <footer className="r1-print__foot">
          {verify}
          {pageNo}
        </footer>
      </article>
    );
  }
  return (
    <article
      ref={sheetRef}
      className={cx("r1-print", p.fit && "r1-print--fit", p.className)}
      style={p.style}
      data-theme="light"
    >
      {head}
      {titles}
      {late ? null : status}
      {facts}
      {late ? status : null}
      {p.children ? <div className="r1-print__body">{p.children}</div> : null}
      <footer className="r1-print__foot">
        {code}
        {verify}
        {pageNo}
      </footer>
    </article>
  );
}

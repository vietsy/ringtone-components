"use client";

import type * as React from "react";
import { Button } from "./Button";
import { StatusIcon } from "./StatusIcon";
import { cx, nounText } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type ScanViewProps = {
  /** unavailable: scanning cannot be used just now, for the reason the page gives */ state?:
    "asking" | "scanning" | "found" | "denied" | "unsupported" | "unavailable" | undefined;
  /** unavailable: the reason sentence */ reason?: string | undefined;
  /** what is scanned ("giấy xác nhận" / "status record"), put into the label and the asking sentence */ recordNoun?:
    string | undefined;
  /** the page's words per state and control; each falls back to the default */ labels?:
    | {
        asking?: string | undefined;
        scanning?: string | undefined;
        found?: string | undefined;
        denied?: string | undefined;
        unsupported?: string | undefined;
        unavailable?: string | undefined;
        allow?: string | undefined;
        torch?: string | undefined;
        manual?: string | undefined;
        help?: string | undefined;
        label?: string | undefined;
      }
    | undefined;
  code?: string | undefined;
  torch?: boolean | undefined;
  onAllow?: (() => void) | undefined;
  onTorch?: (() => void) | undefined;
  onManual?: (() => void) | undefined;
  manualHref?: string | undefined;
  helpHref?: string | undefined;
  label?: string | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The camera view for scanning a record's code, with typing the code as the way out at every step.
// recordNoun names what is scanned ("Quét mã giấy xác nhận"); without it the words name no document type.
// labels: the page's own words per state and per control ({asking, scanning, found, denied, unsupported, unavailable,
// allow, torch, manual, help}), each falling back to the default. unavailable: scanning cannot be used just now for a
// reason the page states (reason, or labels.unavailable); typing the code becomes the primary action, as when denied.
export function ScanView(p: ScanViewProps) {
  const d = tx(p.locale).scan;
  const noun = p.recordNoun ? String(p.recordNoun) : null;
  const t = Object.assign(
    {},
    d,
    { label: nounText(d.label, d.labelNoun, noun), asking: nounText(d.asking, d.askingNoun, noun) },
    p.labels || {},
  );
  const state = p.state || "scanning";
  const words = {
    asking: t.asking,
    scanning: t.scanning,
    found: t.found,
    denied: t.denied,
    unsupported: t.unsupported,
    unavailable: p.reason || t.unavailable,
  }[state];
  const blocked = state === "denied" || state === "unsupported" || state === "unavailable";
  return (
    <section
      className={cx("r1-scan", "r1-scan--" + state, p.className)}
      aria-label={p.label || t.label}
      style={p.style}
    >
      <div className="r1-scan__view" data-theme="player">
        {p.children ? <div className="r1-scan__feed">{p.children}</div> : null}
        {state === "scanning" || state === "found" ? (
          <span className="r1-scan__frame" aria-hidden="true">
            <span className="r1-scan__corner r1-scan__corner--tl" />
            <span className="r1-scan__corner r1-scan__corner--tr" />
            <span className="r1-scan__corner r1-scan__corner--bl" />
            <span className="r1-scan__corner r1-scan__corner--br" />
          </span>
        ) : null}
        <p className="r1-scan__status" role="status">
          {state === "found" ? (
            <StatusIcon family="positive" size={20} cutout="page" />
          ) : blocked ? (
            <StatusIcon family="info" size={20} cutout="page" />
          ) : null}
          <span>{words}</span>
          {state === "found" && p.code ? <span className="r1-mono r1-scan__code">{p.code}</span> : null}
        </p>
      </div>
      <div className="r1-scan__actions">
        {state === "asking" ? (
          <Button variant="primary" size="lg" icon="qr-code" onClick={p.onAllow} locale={p.locale}>
            {t.allow}
          </Button>
        ) : null}
        {state === "denied" && p.helpHref ? (
          <Button variant="secondary" size="lg" href={p.helpHref} locale={p.locale}>
            {t.help}
          </Button>
        ) : null}
        {state === "scanning" && p.torch !== false ? (
          <Button
            variant="secondary"
            size="lg"
            icon="flashlight"
            aria-pressed={p.torch ? "true" : "false"}
            onClick={p.onTorch}
            locale={p.locale}
          >
            {t.torch}
          </Button>
        ) : null}
        <Button
          variant={
            state === "unsupported" || state === "unavailable" || (state === "denied" && !p.helpHref)
              ? "primary"
              : "quiet"
          }
          size="lg"
          icon="keyboard"
          onClick={p.onManual}
          href={p.manualHref}
          locale={p.locale}
        >
          {t.manual}
        </Button>
      </div>
    </section>
  );
}

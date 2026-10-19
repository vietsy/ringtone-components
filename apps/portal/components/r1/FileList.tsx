"use client";

import type * as React from "react";
import { Button } from "./Button";
import { DateValue } from "./DateValue";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";
import { FILE_ICON } from "./lib/documents";
import { nf } from "./lib/formatting";
import { cx, isNil, lang } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type FileListProps = {
  items: {
    key?: string | undefined;
    name: string;
    type?: "pdf" | "image" | "audio" | "sheet" | "other" | undefined;
    size?: string | undefined;
    at?: string | undefined;
    by?: string | undefined;
    href?: string | undefined;
    state?: "uploading" | "ready" | "scanning" | "quarantined" | "failed" | undefined;
    /** uploading: 0 to 100 */ progress?: number | undefined;
    onCancel?: (() => void) | undefined;
    /** failed: draws Upload again */ onRetry?: (() => void) | undefined;
    reason?: string | undefined;
    removable?: boolean | undefined;
    onRemove?: (() => void) | undefined;
  }[];
  label?: string | undefined;
  emptyText?: string | undefined;
  density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Files attached to a record: name, kind, size, who added it and when, and whether it can be opened yet.
// uploading shows its progress and a way to stop it; a failed file offers to upload it again.
export function FileList(p: FileListProps) {
  const t = tx(p.locale).files;
  const items = p.items || [];
  if (!items.length) return <p className="r1-files__empty">{p.emptyText || t.none}</p>;
  return (
    <ul
      className={cx("r1-files", "r1-files--" + (p.density || "portal"), p.className)}
      aria-label={p.label}
      style={p.style}
    >
      {items.map(function (f, i) {
        const st = f.state || "ready";
        const ready = st === "ready";
        const up = st === "uploading";
        const pct = isNil(f.progress) ? null : Math.max(0, Math.min(100, Math.round(f.progress)));
        const pctText = pct === null ? null : nf(p.locale).format(pct) + (lang(p.locale) === "en" ? "%" : "\u00a0%");
        return (
          <li key={f.key || i} className={cx("r1-file", "r1-file--" + st)}>
            <Icon
              name={(FILE_ICON as Partial<Record<string, string>>)[String(f.type)] || "file"}
              size={p.density === "console" ? 16 : 20}
              className="r1-file__icon"
            />
            <span className="r1-file__main">
              {ready && f.href ? (
                <a className="r1-link r1-file__name" href={f.href}>
                  {f.name}
                </a>
              ) : (
                <span className="r1-file__name">{f.name}</span>
              )}
              <span className="r1-file__meta">
                {f.size ? <span>{f.size}</span> : null}
                {f.at ? <DateValue value={f.at} mode="stamp" locale={p.locale} /> : null}
                {f.by ? <span>{f.by}</span> : null}
              </span>
              {up ? (
                <span className="r1-file__progress">
                  <span
                    className="r1-file__bar"
                    role="progressbar"
                    aria-label={t.uploading + ": " + f.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct === null ? undefined : pct}
                    aria-valuetext={pctText || undefined}
                  >
                    <span className="r1-file__fill" style={{ width: (pct || 0) + "%" }} />
                  </span>
                  {pctText ? <span className="r1-file__pct r1-num">{pctText}</span> : null}
                </span>
              ) : null}
              {!ready && f.reason ? <span className="r1-file__reason">{f.reason}</span> : null}
              {st === "failed" && f.onRetry ? (
                <span className="r1-file__again">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="refresh-cw"
                    onClick={f.onRetry}
                    aria-label={t.retry + ": " + f.name}
                    locale={p.locale}
                  >
                    {t.retry}
                  </Button>
                </span>
              ) : null}
            </span>
            {!ready ? (
              <StatusBadge
                family={up || st === "scanning" ? "info" : st === "quarantined" ? "attention" : "danger"}
                label={t[st]}
                size="sm"
              />
            ) : null}
            {up && f.onCancel ? (
              <Button
                variant="quiet"
                size="sm"
                iconOnly={true}
                icon="x"
                aria-label={t.cancel + ": " + f.name}
                onClick={f.onCancel}
                locale={p.locale}
              />
            ) : null}
            {ready && f.href ? (
              <Button
                variant="quiet"
                size="sm"
                iconOnly={true}
                icon="download"
                href={f.href}
                aria-label={t.download + ": " + f.name}
                locale={p.locale}
              />
            ) : null}
            {f.removable && !up ? (
              <Button
                variant="quiet"
                size="sm"
                iconOnly={true}
                icon="trash-2"
                aria-label={t.remove + ": " + f.name}
                onClick={f.onRemove}
                locale={p.locale}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

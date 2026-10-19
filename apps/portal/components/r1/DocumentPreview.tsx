"use client";

import type * as React from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { StatusIcon } from "./StatusIcon";
import { FILE_ICON } from "./lib/documents";
import { cx, lang, useSynced } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type DocumentPreviewProps = {
  title: string;
  type?: "pdf" | "image" | "other" | undefined;
  page?: number | undefined;
  pages?: number | undefined;
  zoom?: number | undefined;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
  onPageChange?: ((page: number) => void) | undefined;
  onZoomChange?: ((percent: number) => void) | undefined;
  href?: string | undefined;
  unavailable?: boolean | string | undefined;
  /** the page is on its way: a blank sheet names the page */ loading?: boolean | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A document page beside the facts it supports, with its own page and zoom controls. The page is the children.
// Page and zoom work on their own; the page is told through onPageChange(page) and onZoomChange(percent),
// and onPrev, onNext, onZoomIn, onZoomOut still fire. Zoom runs from 50 to 200 % in steps of 25; the text
// scales with the sheet. A file that cannot be shown keeps only its download.
export function DocumentPreview(p: DocumentPreviewProps) {
  const t = tx(p.locale).doc;
  const pages = p.pages || 1;
  const pg = useSynced(p.page, 1);
  const zm = useSynced(p.zoom, 100);
  const page = pg[0],
    zoom = zm[0];
  function toPage(n: number, cb: (() => void) | undefined) {
    const v = Math.max(1, Math.min(pages, n));
    pg[1](v);
    if (p.onPageChange) p.onPageChange(v);
    if (cb) cb();
  }
  function toZoom(n: number, cb: (() => void) | undefined) {
    const v = Math.max(50, Math.min(200, n));
    zm[1](v);
    if (p.onZoomChange) p.onZoomChange(v);
    if (cb) cb();
  }
  const f = zoom / 100;
  return (
    <section className={cx("r1-docview", p.className)} aria-label={p.title} style={p.style}>
      <div className="r1-docview__bar">
        <span className="r1-docview__name">
          <Icon name={(FILE_ICON as Partial<Record<string, string>>)[String(p.type)] || "file-text"} size={16} />
          <span>{p.title}</span>
        </span>
        <span className="r1-docview__tools">
          {!p.unavailable && pages > 1 ? (
            <Button
              variant="quiet"
              size="sm"
              iconOnly={true}
              icon="chevron-left"
              aria-label={t.prev}
              disabled={page <= 1}
              onClick={function () {
                toPage(page - 1, p.onPrev);
              }}
              locale={p.locale}
            />
          ) : null}
          {!p.unavailable ? (
            <span className="r1-docview__page r1-num" aria-live="polite">
              {t.page.replace("{n}", String(page)).replace("{of}", String(pages))}
            </span>
          ) : null}
          {!p.unavailable && pages > 1 ? (
            <Button
              variant="quiet"
              size="sm"
              iconOnly={true}
              icon="chevron-right"
              aria-label={t.next}
              disabled={page >= pages}
              onClick={function () {
                toPage(page + 1, p.onNext);
              }}
              locale={p.locale}
            />
          ) : null}
          {!p.unavailable ? <span className="r1-docview__sep" aria-hidden="true" /> : null}
          {!p.unavailable ? (
            <Button
              variant="quiet"
              size="sm"
              iconOnly={true}
              icon="minus"
              aria-label={t.zoomOut}
              disabled={zoom <= 50}
              onClick={function () {
                toZoom(zoom - 25, p.onZoomOut);
              }}
              locale={p.locale}
            />
          ) : null}
          {!p.unavailable ? (
            <span className="r1-docview__zoom r1-num" aria-live="polite">
              {zoom + (lang(p.locale) === "en" ? "%" : "\u00a0%")}
            </span>
          ) : null}
          {!p.unavailable ? (
            <Button
              variant="quiet"
              size="sm"
              iconOnly={true}
              icon="plus"
              aria-label={t.zoomIn}
              disabled={zoom >= 200}
              onClick={function () {
                toZoom(zoom + 25, p.onZoomIn);
              }}
              locale={p.locale}
            />
          ) : null}
          {p.href ? (
            <Button
              variant="quiet"
              size="sm"
              iconOnly={true}
              icon="download"
              href={p.href}
              aria-label={t.download + ": " + p.title}
              locale={p.locale}
            />
          ) : null}
        </span>
      </div>
      <div className="r1-docview__stage">
        {p.unavailable ? (
          <div className="r1-docview__off">
            <StatusIcon family="info" size={20} cutout="surface-sunken" />
            <span>{typeof p.unavailable === "string" ? p.unavailable : t.unavailable}</span>
          </div>
        ) : // loading: the page is on its way; a blank sheet says which page, so the tools above keep their place.
        p.loading ? (
          <div className="r1-docview__sheet r1-docview__sheet--loading" role="status" data-theme="light">
            <Icon name="loader-circle" size={20} spin={true} />
            <span>{t.loading.replace("{n}", String(page))}</span>
          </div>
        ) : (
          <div
            className="r1-docview__sheet"
            data-theme="light"
            style={
              zoom !== 100
                ? {
                    width: "calc(var(--container-lg) * " + f + ")",
                    maxWidth: "none",
                    fontSize: "calc(var(--text-xs) * " + f + ")",
                    lineHeight: "calc(var(--leading-xs) * " + f + ")",
                  }
                : undefined
            }
          >
            {p.children}
          </div>
        )}
      </div>
    </section>
  );
}

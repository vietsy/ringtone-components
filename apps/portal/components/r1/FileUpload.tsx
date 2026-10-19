"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { FieldMessage } from "./FieldMessage";
import { Icon } from "./Icon";
import { StatusIcon } from "./StatusIcon";
import { announce, cx, readerActed, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Family, Locale } from "./lib/types";

export type FileUploadProps = {
  label?: string | undefined;
  helper?: string | undefined;
  required?: boolean | undefined;
  accept?: string | undefined;
  onFiles?: ((files: FileList) => void) | undefined;
  onReplace?: ((files: FileList) => void) | undefined;
  onRemove?: (() => void) | undefined;
  /** portal or premises draws Choose another file and Remove at the portal's field height (48 px) with 20 px icons; console, the default, at 32 px with 16 px icons; the chooser before a file is a link in every density */ density?:
    "console" | "portal" | "premises" | undefined;
  state?: "idle" | "dragover" | "rejected" | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  fileName?: string | undefined;
  fileSize?: string | undefined;
  stages?:
    | { label: string; state?: "done" | "current" | "todo" | "failed" | undefined; detail?: string | undefined }[]
    | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Before a file: a drop zone whose chooser takes the keyboard (the zone shows the focus ring). disabled keeps the
// zone in view, greyed, with disabledReason under it. After a file: its stages, each with its state in words;
// every change of stage is said once. The file can be replaced (onReplace, else onFiles) or removed (onRemove);
// density 'portal' or 'premises' draws those two at the portal's field height with 20 px icons, 'console' (the
// default) at 32 px with 16 px icons. The chooser before a file is a link in every density.
// Label, helper, required marker and error stay in every state, so a refusal after the upload still shows.
export function FileUpload(p: FileUploadProps) {
  const t = tx(p.locale);
  const id = useUid("r1-up");
  const drag = useState(false);
  const off = !!p.disabled;
  const stages = p.stages || [];
  const key = stages
    .map(function (s) {
      return s.label + ":" + (s.state || "todo");
    })
    .join("|");
  const first = useRef(true);
  useEffect(
    function () {
      const mount = first.current;
      first.current = false;
      if (!p.fileName || !stages.length || (mount && !readerActed())) return;
      const failed = stages.filter(function (s) {
        return s.state === "failed";
      })[0];
      const now = stages.filter(function (s) {
        return s.state === "current";
      })[0];
      const done = stages.every(function (s) {
        return s.state === "done";
      });
      const text = failed
        ? failed.label + ": " + t.upload.states.failed + (failed.detail ? ". " + failed.detail : "")
        : done
          ? t.upload.ready
          : now
            ? now.label + ": " + t.upload.states.current + (now.detail ? ". " + now.detail : "")
            : "";
      if (text) announce(text, failed ? "assertive" : "polite");
    },
    [key, p.fileName],
  );
  const why =
    off && p.disabledReason ? (
      <div id={id + "-why"} className="r1-field__reason">
        <Icon name="info" size={16} />
        <span>{p.disabledReason}</span>
      </div>
    ) : null;
  const msg = p.error ? (
    <FieldMessage id={id + "-msg"} severity="error" locale={p.locale}>
      {p.error}
    </FieldMessage>
  ) : null;
  const req = p.required ? <span className="r1-field__req">{" " + t.required}</span> : null;
  const help = p.helper ? (
    <div id={id + "-help"} className="r1-field__help">
      {p.helper}
    </div>
  ) : null;
  const replace = off ? null : p.onReplace || p.onFiles;
  const big = p.density === "portal" || p.density === "premises";
  if (!p.fileName) {
    // over: a file is being dragged across the zone. rejected: the last file was refused, and error says why.
    const over = !off && (p.state === "dragover" || drag[0]);
    const rejected = !off && (p.state === "rejected" || !!p.error);
    const zoneEvents = off
      ? {}
      : {
          onDragOver: function (e: React.DragEvent<HTMLDivElement>) {
            e.preventDefault();
            if (!drag[0]) drag[1](true);
          },
          onDragLeave: function () {
            drag[1](false);
          },
          onDrop: function (e: React.DragEvent<HTMLDivElement>) {
            e.preventDefault();
            drag[1](false);
            if (p.onFiles) p.onFiles(e.dataTransfer.files);
          },
        };
    return (
      <div
        className={cx("r1-upload", rejected && "r1-upload--rejected", off && "r1-upload--disabled", p.className)}
        style={p.style}
      >
        {p.label ? (
          <label className="r1-field__label" htmlFor={id}>
            {p.label}
            {req}
          </label>
        ) : null}
        {help}
        <div className={cx("r1-upload__zone", over && "r1-upload__zone--over")} {...zoneEvents}>
          <Icon name="upload" size={24} />
          {over ? (
            <span>{t.upload.release}</span>
          ) : (
            [
              <span key="d">{t.upload.drop + " "}</span>,
              <label key="c" className={off ? "r1-upload__choose" : "r1-link"} htmlFor={id}>
                {t.upload.choose}
              </label>,
            ]
          )}
          <input
            id={id}
            type="file"
            className="r1-sr r1-upload__input"
            accept={p.accept}
            disabled={off}
            required={p.required}
            aria-invalid={rejected ? "true" : undefined}
            aria-describedby={
              [p.helper && id + "-help", p.error && id + "-msg", why && id + "-why"].filter(Boolean).join(" ") ||
              undefined
            }
            onChange={
              p.onFiles
                ? function (e) {
                    p.onFiles!(e.target.files!);
                  }
                : undefined
            }
          />
        </div>
        {msg}
        {why}
      </div>
    );
  }
  const mark: Record<string, Family> = { done: "positive", failed: "danger", current: "info" };
  return (
    <div
      className={cx("r1-upload r1-upload--active", p.error && "r1-upload--rejected", p.className)}
      style={p.style}
      role="group"
      aria-labelledby={p.label ? id + "-label" : undefined}
      aria-describedby={[p.helper && id + "-help", p.error && id + "-msg"].filter(Boolean).join(" ") || undefined}
    >
      {p.label ? (
        <span id={id + "-label"} className="r1-field__label">
          {p.label}
          {req}
        </span>
      ) : null}
      {help}
      <div className="r1-upload__file">
        <Icon name="file-text" size={20} />
        <span className="r1-upload__name r1-strong">{p.fileName}</span>
        {p.fileSize ? <span className="r1-upload__size r1-muted">{p.fileSize}</span> : null}
      </div>
      {stages.length ? (
        <ol className="r1-pipeline" aria-label={t.upload.pipeline}>
          {stages.map(function (s, i) {
            const state = s.state || "todo";
            return (
              <li
                key={i}
                className={cx("r1-pipeline__stage", "r1-pipeline__stage--" + state)}
                aria-current={state === "current" ? "step" : undefined}
              >
                {state === "current" ? (
                  <Icon name="loader-circle" size={16} spin={true} />
                ) : (
                  <StatusIcon family={mark[state] || "neutral"} size={16} cutout="surface" />
                )}
                <span className="r1-pipeline__label">
                  {s.label}
                  <span className="r1-sr">{", " + (t.upload.states[state] || t.upload.states.todo)}</span>
                </span>
                {s.detail ? <span className="r1-pipeline__detail r1-muted">{s.detail}</span> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {msg}
      {replace || p.onRemove ? (
        <div className="r1-upload__actions">
          {replace ? (
            <span className="r1-upload__replace">
              <input
                id={id + "-again"}
                type="file"
                className="r1-sr r1-upload__input"
                accept={p.accept}
                onChange={function (e) {
                  replace(e.target.files!);
                }}
              />
              <label
                className={cx("r1-btn r1-btn--secondary", big ? "r1-btn--md" : "r1-btn--sm")}
                htmlFor={id + "-again"}
              >
                <Icon name="upload" size={big ? 20 : 16} />
                <span className="r1-btn__label">{t.upload.replace}</span>
              </label>
            </span>
          ) : null}
          {p.onRemove ? (
            <Button variant="quiet" size={big ? "md" : "sm"} icon="trash-2" onClick={p.onRemove} locale={p.locale}>
              {t.files.remove}
            </Button>
          ) : null}
        </div>
      ) : null}
      {why}
    </div>
  );
}

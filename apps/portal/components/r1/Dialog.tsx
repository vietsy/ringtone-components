"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import type { ButtonProps } from "./Button";
import { Icon } from "./Icon";
import { keepRefs } from "./lib/button";
import { useHostTheme } from "./lib/dialog";
import { cx, focusEl, focusables, isNil, readerActed, useLatest, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type DialogProps = {
  title: React.ReactNode;
  /** a reference in it (R1-CER-2026-W5HK8TQM) stays whole, as in the title */ description?:
    React.ReactNode | undefined;
  primaryAction?:
    | {
        label: string;
        variant?: string | undefined;
        loading?: boolean | undefined;
        disabled?: boolean | undefined;
        disabledReason?: string | undefined;
        onClick?: (() => void) | undefined;
        /** the accessible name when the label needs the object out of context; it starts with the label */ ariaLabel?:
          string | undefined;
      }
    | undefined;
  secondaryAction?:
    { label: string; /** without it the way out closes the dialog */ onClick?: (() => void) | undefined } | undefined;
  onClose?: (() => void) | undefined;
  open?: boolean | undefined;
  placement?: "viewport" | "overlay" | "inline" | undefined;
  /** start: near the top of what the dialog covers (space-16 down), for an overlay on a tall page; the backdrop still covers it all. Default center */ align?:
    "center" | "start" | undefined;
  /** focus opens on the title, never on a button or a field; true forces it on a canvas, false never moves it */ autoFocus?:
    boolean | undefined;
  width?: number | string | undefined;
  density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
};

export function Dialog(p: DialogProps) {
  const t = tx(p.locale);
  const titleId = useUid("r1-dlg");
  const panelRef = useRef<HTMLDivElement>(null);
  const host = useHostTheme(p.placement === "viewport");
  const dismissed = useState(false);
  const shown = p.open !== false && !(isNil(p.open) && dismissed[0]);
  const modal = p.placement !== "inline";
  function close() {
    if (p.onClose) p.onClose();
    if (isNil(p.open)) dismissed[1](true);
  }
  const latest = useLatest({ close: close });
  useEffect(
    function () {
      if (!shown || !modal) return undefined;
      const panel = panelRef.current;
      const opener: (Element & Partial<Pick<HTMLOrSVGElement, "focus">>) | null = document.activeElement;
      const take = p.autoFocus === true || (p.autoFocus !== false && readerActed());
      if (!panel || !take) return undefined;
      // Focus opens on the title, never on a button or a field (decision of 7 October 2026): the reader hears the
      // decision and the object it names first, then the description; Enter or Space pressed out of habit acts on
      // nothing; and Tab reaches the first field or action next, in reading order.
      focusEl(panel.querySelector<HTMLElement>(".r1-dialog__title"));
      const released: Element[] = [];
      if (p.placement === "viewport") {
        Array.prototype.forEach.call(document.body.children, function (el: Element) {
          if (!el.contains(panel) && !el.hasAttribute("inert") && !el.hasAttribute("data-r1-live")) {
            el.setAttribute("inert", "");
            released.push(el);
          }
        });
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
          e.stopPropagation();
          latest.current.close();
          return;
        }
        if (e.key !== "Tab") return;
        const list = focusables(panel);
        if (!list.length) {
          e.preventDefault();
          return;
        }
        const first = list[0],
          last = list[list.length - 1],
          at = document.activeElement,
          inside = panel!.contains(at);
        if (e.shiftKey && (at === first || !inside)) {
          e.preventDefault();
          focusEl(last);
        } else if (!e.shiftKey && (at === last || !inside)) {
          e.preventDefault();
          focusEl(first);
        }
      }
      document.addEventListener("keydown", onKey, true);
      return function () {
        document.removeEventListener("keydown", onKey, true);
        released.forEach(function (el) {
          el.removeAttribute("inert");
        });
        if (opener && opener.focus && document.contains(opener)) focusEl(opener);
      };
    },
    [shown, modal],
  );
  if (!shown) return null;
  const sec: Partial<NonNullable<DialogProps["secondaryAction"]>> = p.secondaryAction || {};
  const btnSize = p.density === "console" ? "sm" : undefined;
  const panel = (
    <div
      ref={panelRef}
      className="r1-dialog"
      role="dialog"
      aria-modal={modal ? "true" : undefined}
      aria-labelledby={titleId}
      aria-describedby={p.description ? titleId + "-d" : undefined}
      style={{ width: p.width || "var(--container-lg)" }}
    >
      <div className="r1-dialog__head">
        <h2 id={titleId} className="r1-dialog__title" tabIndex={-1}>
          {keepRefs(p.title)}
        </h2>
        <button
          type="button"
          className={cx("r1-btn r1-btn--quiet", p.density === "console" && "r1-btn--sm", "r1-btn--icon r1-btn--close")}
          aria-label={t.close}
          onClick={close}
        >
          <Icon name="x" size={p.density === "console" ? 16 : 20} />
        </button>
      </div>
      {p.description ? (
        <p id={titleId + "-d"} className="r1-dialog__desc">
          {keepRefs(p.description)}
        </p>
      ) : null}
      {p.children ? <div className="r1-dialog__body">{p.children}</div> : null}
      <div className="r1-dialog__foot">
        {p.primaryAction ? (
          <Button
            size={btnSize}
            variant={(p.primaryAction.variant || "primary") as ButtonProps["variant"]}
            loading={p.primaryAction.loading}
            onClick={p.primaryAction.onClick}
            locale={p.locale}
            disabled={p.primaryAction.disabled}
            disabledReason={p.primaryAction.disabledReason}
            ariaLabel={p.primaryAction.ariaLabel}
          >
            {p.primaryAction.label}
          </Button>
        ) : null}
        <Button size={btnSize} variant="quiet" onClick={sec.onClick || close} locale={p.locale}>
          {sec.label || t.cancel}
        </Button>
      </div>
    </div>
  );
  if (!modal) return panel;
  const portal = p.placement === "viewport" && !!createPortal && typeof document !== "undefined";
  // align 'start': the dialog sits near the top of what it covers (a tall page in a frame), the backdrop still covers it all.
  const layer = (
    <div
      className={cx(
        "r1-dialog-layer",
        p.placement === "viewport" && "r1-dialog-layer--viewport",
        p.align === "start" && "r1-dialog-layer--start",
      )}
      data-theme={portal && host.theme ? host.theme : undefined}
    >
      <div className="r1-dialog-backdrop" aria-hidden="true" />
      {panel}
    </div>
  );
  if (portal)
    return (
      <>
        <span ref={host.ref} hidden={true} />
        {createPortal(layer, document.body)}
      </>
    );
  return layer;
}

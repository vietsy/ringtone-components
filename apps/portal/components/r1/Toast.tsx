"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { StatusIcon } from "./StatusIcon";
import { keepRefs } from "./lib/button";
import { useHostTheme } from "./lib/dialog";
import { announce, cx, isNil, joinSentences, lang, readerActed, textOf, useLatest } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Family, Locale } from "./lib/types";

// A short confirmation after an action that did not leave the page. It never carries the only copy of an error.
// floating: it joins one stack at the bottom right of the window, newest at the bottom, three in view.
// A positive, info or neutral toast that appeared after the reader acted closes itself after duration ms
// (floating: 8 s by default; never under 6 s), and not while the pointer or focus is on it. attention and
// danger toasts stay until closed. Close always works: the toast hides itself and then calls onClose.
function toastStack() {
  if (typeof document === "undefined" || !document.body) return null;
  let el = document.querySelector("[data-r1-toasts]");
  if (!el) {
    el = document.createElement("div");
    el.setAttribute("data-r1-toasts", "");
    el.className = "r1-toasts";
    document.body.appendChild(el);
  }
  return el;
}

export type ToastProps = {
  family?: Family | undefined;
  title?: React.ReactNode | undefined;
  action?: { label: string; onClick?: (() => void) | undefined; href?: string | undefined } | undefined;
  onClose?: ((e?: unknown) => void) | undefined;
  floating?: boolean | undefined;
  duration?: number | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function Toast(p: ToastProps) {
  const t = tx(p.locale);
  const family = p.family || "positive";
  const host = useHostTheme(!!p.floating);
  const shown = useState(true);
  const held = useRef(false);
  const latest = useLatest(p);
  const said = joinSentences([textOf(p.title), textOf(p.children)]);
  useEffect(
    function () {
      announce(said, family === "danger" ? "assertive" : "polite");
    },
    [said],
  );
  const lasting = family === "attention" || family === "danger";
  const ms = lasting ? 0 : !isNil(p.duration) ? (p.duration ? Math.max(6000, p.duration) : 0) : p.floating ? 8000 : 0;
  function close(e?: unknown): void {
    shown[1](false);
    if (latest.current.onClose) latest.current.onClose(e);
  }
  useEffect(
    function () {
      if (!ms || !readerActed()) return undefined;
      let used = 0;
      const timer = setInterval(function () {
        if (held.current) return;
        used += 250;
        if (used >= ms) {
          clearInterval(timer);
          close();
        }
      }, 250);
      return function () {
        clearInterval(timer);
      };
    },
    [ms, said],
  );
  if (!shown[0]) return null;
  function hold(v: boolean) {
    return function () {
      held.current = v;
    };
  }
  const el = (
    <div
      className={cx("r1-toast", "r1-toast--" + family, p.floating && "r1-toast--floating", p.className)}
      style={p.style}
      lang={p.floating ? lang(p.locale) : undefined}
      data-theme={p.floating && host.theme ? host.theme : undefined}
      onMouseEnter={hold(true)}
      onMouseLeave={hold(false)}
      onFocus={hold(true)}
      onBlur={hold(false)}
    >
      <StatusIcon family={family} size={20} cutout="surface" />
      <div className="r1-toast__body">
        {p.title ? <p className="r1-toast__title">{keepRefs(p.title)}</p> : null}
        {p.children ? <p className="r1-toast__text">{keepRefs(p.children)}</p> : null}
        {p.action ? (
          <div className="r1-toast__actions">
            <Button variant="quiet" size="sm" onClick={p.action.onClick} href={p.action.href} locale={p.locale}>
              {p.action.label}
            </Button>
          </div>
        ) : null}
      </div>
      <Button
        className="r1-btn--close"
        variant="quiet"
        size="sm"
        iconOnly={true}
        icon="x"
        aria-label={t.toast.close}
        onClick={close}
        locale={p.locale}
      />
    </div>
  );
  const stack = p.floating ? toastStack() : null;
  return stack ? (
    <>
      <span ref={host.ref} hidden={true} />
      {createPortal(el, stack)}
    </>
  ) : (
    el
  );
}

"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";
import { cx, focusEl, isNil, readerActed, textOf, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { ActionSpec, Locale, StatusValue } from "./lib/types";

export type SidePanelProps = {
  title: React.ReactNode;
  eyebrow?: string | undefined;
  status?: StatusValue | undefined;
  actions?: ActionSpec[] | undefined;
  /** without it the panel closes itself; false: no close */ onClose?: (() => void) | false | undefined;
  open?: boolean | undefined;
  autoFocus?: boolean | undefined;
  density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

// A record opened beside a queue or a form. It does not block the page behind it. When the reader opens it,
// focus moves to its title; Escape or the close button closes it and focus goes back to what opened it.
// Without onClose (and without a controlled open) it closes itself; onClose={false} keeps it with no close.
export function SidePanel(p: SidePanelProps) {
  const t = tx(p.locale);
  const id = useUid("r1-side");
  const ref = useRef<HTMLElement>(null);
  const size = p.density === "portal" ? "md" : "sm";
  const dismissed = useState(false);
  const shown = p.open !== false && !(isNil(p.open) && dismissed[0]);
  const closable = p.onClose !== false;
  function close() {
    if (typeof p.onClose === "function") p.onClose();
    if (isNil(p.open)) dismissed[1](true);
  }
  useEffect(
    function () {
      if (!shown) return undefined;
      const opener: (Element & Partial<Pick<HTMLOrSVGElement, "focus">>) | null = document.activeElement;
      const take = p.autoFocus === true || (p.autoFocus !== false && readerActed());
      if (take && ref.current) focusEl(ref.current.querySelector<HTMLElement>(".r1-side__title"));
      return function () {
        const at = document.activeElement;
        if (
          take &&
          opener &&
          opener.focus &&
          document.contains(opener) &&
          (!at || at === document.body || (ref.current && ref.current.contains(at)))
        )
          focusEl(opener);
      };
    },
    [shown],
  );
  if (!shown) return null;
  return (
    <aside
      ref={ref}
      className={cx("r1-side", "r1-side--" + (p.density || "console"), p.className)}
      aria-labelledby={id}
      style={p.style}
      onKeyDown={
        closable
          ? function (e) {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
              }
            }
          : undefined
      }
    >
      <div className="r1-side__head">
        <div className="r1-side__titles">
          {p.eyebrow ? <span className="r1-side__eyebrow">{p.eyebrow}</span> : null}
          <h2 id={id} className="r1-side__title" tabIndex={-1}>
            {p.title}
          </h2>
          {p.status ? (
            <StatusBadge family={p.status.family} label={p.status.label} icon={p.status.icon} size="sm" />
          ) : null}
        </div>
        {closable ? (
          <Button
            className="r1-btn--close"
            variant="quiet"
            size={size}
            iconOnly={true}
            icon="x"
            aria-label={t.side.close + ": " + (typeof p.title === "string" ? p.title : textOf(p.title))}
            onClick={close}
            aria-keyshortcuts="Escape"
            locale={p.locale}
          />
        ) : null}
      </div>
      <div className="r1-side__body">{p.children}</div>
      {p.actions && p.actions.length ? (
        <div className="r1-side__foot">
          {p.actions.map(function (a, i) {
            return (
              <Button
                key={i}
                variant={a.variant || (i ? "secondary" : "primary")}
                size={size}
                icon={a.icon}
                href={a.href}
                disabled={a.disabled}
                disabledReason={a.disabledReason}
                onClick={a.onClick}
                locale={p.locale}
              >
                {a.label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}

"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { cx, focusEl, focusables, isTyping } from "./lib/helpers";
import { bindableShortcut, holdAlt, keyTaken, singleKeyOff, takeKey, useSingleKeys } from "./lib/keyboard-rules";
import { shortcutAria, shortcutHit, shortcutText } from "./lib/search-and-pick";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type FilterBarProps = {
  chips?: { label: string; onRemove?: ((e: React.MouseEvent<HTMLButtonElement>) => void) | undefined }[] | undefined;
  summary?: React.ReactNode | undefined;
  active?: boolean | undefined;
  onClear?: ((e: unknown) => void) | undefined;
  label?: string | undefined;
  /** one key ("/") that focuses the first field from anywhere in the shell; listed in ConsoleShell's keys with the label */ shortcut?:
    string | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The row of filters above a list: fields bottom-aligned, the result count and a way back to everything.
// The count is a live region from the first render, so a new count is said. When a chip or Clear filters
// goes away under the reader's focus, focus moves to the next chip, then Clear filters, then the first field.
// shortcut: one key ("/") that puts focus in the bar's first field from anywhere in its shell. It is bound as
// SearchField's and Button's are, on the nearest .r1-shell and never on the document; a bare key never fires while
// the reader types in a field, nor from inside a dialog the bar is not in. data-r1-shortcut marks the bar from the
// first render, so ConsoleShell's list of keys shows it with the bar's label; bound, the bar sets aria-keyshortcuts.
export function FilterBar(p: FilterBarProps) {
  const t = tx(p.locale);
  const rootRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<number | "fields" | null>(null);
  const chips = p.chips || [];
  const sc = p.shortcut ? bindableShortcut(p.shortcut, 'the filter bar "' + (p.label || t.filters) + '"') : null;
  const scBound = useState(false);
  const singleOn = useSingleKeys();
  const scOff = useState(false);
  useEffect(
    function () {
      const scope = sc && rootRef.current && rootRef.current.closest<HTMLElement>(".r1-shell");
      const off = singleKeyOff(sc, scope, singleOn);
      if (scOff[0] !== off) scOff[1](off);
      if (scBound[0] !== (!!scope && !off)) scBound[1](!!scope && !off);
      if (!scope || off) return undefined;
      function onKey(e: KeyboardEvent) {
        if (keyTaken(e)) return;
        if (!shortcutHit(e, sc!)) return;
        if (!sc!.mod && !sc!.alt && isTyping(e.target)) return;
        holdAlt(e, sc!);
        const root = rootRef.current;
        const dlg = e.target && (e.target as Element).closest && (e.target as Element).closest('[role="dialog"]');
        if (!root || (dlg && !dlg.contains(root))) return;
        const field = focusables(root.querySelector(".r1-filterbar__fields"))[0];
        if (!field) return;
        takeKey(e);
        e.stopPropagation();
        focusEl(field);
        if ((field as HTMLInputElement).select && /^(INPUT|TEXTAREA)$/.test(field.tagName))
          (field as HTMLInputElement).select();
      }
      scope.addEventListener("keydown", onKey);
      return function () {
        scope.removeEventListener("keydown", onKey);
      };
    },
    [sc ? (sc.mod ? "mod+" : "") + (sc.alt ? "alt+" : "") + sc.key : "", singleOn],
  );
  const scName = sc && scBound[0] ? shortcutAria(sc) : undefined;
  // Escape in a text filter clears that filter and does nothing else (OD-19, 7 October 2026): the value is emptied the
  // way typing would empty it, so the field's onChange and the page's filtering run, focus stays in the field, and the
  // key goes no further. An empty field, a select or a combobox lets Escape pass, so a dialog or a list closes as usual;
  // a SearchField has already cleared itself.
  function clearOnEscape(e: React.KeyboardEvent<HTMLDivElement>) {
    const el = e.target as HTMLInputElement;
    if (e.key !== "Escape" || (e.nativeEvent || e).defaultPrevented || !el || !el.value) return;
    const proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement
        : el.tagName === "INPUT" && /^(text|search|email|tel|url|number|)$/.test(el.type || "")
          ? window.HTMLInputElement
          : null;
    if (!proto || el.readOnly || el.disabled || el.getAttribute("role") === "combobox") return;
    const set = (
      Object.getOwnPropertyDescriptor(proto.prototype, "value") as { set: (this: HTMLElement, v: string) => void }
    ).set;
    set.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    e.preventDefault();
    e.stopPropagation();
  }
  useEffect(function () {
    const root = rootRef.current,
      want = refocus.current;
    if (!root || want === null) return;
    const at = document.activeElement;
    if (at && at !== document.body && root.contains(at)) return;
    refocus.current = null;
    if (at && at !== document.body) return;
    const list = root.querySelectorAll(".r1-chip");
    const next = typeof want === "number" && list.length ? list[Math.min(want, list.length - 1)] : null;
    focusEl(
      next ||
        root.querySelector(".r1-filterbar__end .r1-btn") ||
        focusables(root.querySelector(".r1-filterbar__fields"))[0],
    );
  });
  return (
    <div
      ref={rootRef}
      className={cx("r1-filterbar", p.className)}
      role="group"
      aria-label={p.label || t.filters}
      style={p.style}
      data-r1-shortcut={sc ? shortcutText(p.shortcut, sc) : undefined}
      data-r1-shortcut-off={sc && scOff[0] ? "" : undefined}
      aria-keyshortcuts={scName}
    >
      <div className="r1-filterbar__fields" onKeyDown={clearOnEscape}>
        {p.children}
      </div>
      {chips.length ? (
        <ul className="r1-filterbar__chips" aria-label={t.filters}>
          {chips.map(function (c, i) {
            return (
              <li key={i}>
                <button
                  type="button"
                  className="r1-chip"
                  aria-label={t.chip.remove + ": " + c.label}
                  onClick={function (e) {
                    refocus.current = i;
                    if (c.onRemove) c.onRemove(e);
                  }}
                >
                  <span>{c.label}</span>
                  <Icon name="x" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="r1-filterbar__end">
        <span className="r1-filterbar__summary" role="status">
          {p.summary}
        </span>
        {p.active ? (
          <Button
            variant="quiet"
            size="sm"
            icon="x"
            onClick={function (e) {
              refocus.current = "fields";
              if (p.onClear) p.onClear(e);
            }}
            locale={p.locale}
          >
            {t.empty.clearFilters}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { describedBy, fieldIconSize, fieldShell, sizedField } from "./lib/form-parts";
import { announce, cx, focusEl, isNil, isTyping, textOf, useSynced, useUid } from "./lib/helpers";
import { bindableShortcut, keyTaken, singleKeyOff, takeKey, useSingleKeys } from "./lib/keyboard-rules";
import { resultWords, shortcutAria, shortcutHit, shortcutText } from "./lib/search-and-pick";
import { tx } from "./lib/strings";
import type { FieldBase, OnValue } from "./lib/types";

export type SearchFieldProps = Omit<FieldBase, "readOnly" | "provenance" | "provenanceDetail"> & {
  hideLabel?: boolean | undefined;
  placeholder?: string | undefined;
  value?: string | undefined;
  onChange?: OnValue<string> | undefined;
  onSearch?: OnValue<string> | undefined;
  loading?: boolean | undefined;
  busy?: boolean | undefined;
  resultCount?: number | undefined;
  shortcut?: string | undefined;
};

export function SearchField(p: SearchFieldProps) {
  const t = tx(p.locale);
  const id = useUid("r1-search");
  const st = useSynced(p.value, "");
  const val = st[0];
  const busy = !!(p.loading || p.busy);
  const inputRef = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  // The shortcut is bound on the nearest shell (PublicShell, PortalShell, ConsoleShell), never on the document:
  // it works while focus is anywhere in that shell. With no shell around the field it stays a drawn hint.
  // A bare key ("/") never takes over typing in another box.
  const sc = p.shortcut ? bindableShortcut(p.shortcut, 'the search field "' + textOf(p.label) + '"') : null;
  const bound = useState(false);
  const singleOn = useSingleKeys();
  const scOff = useState(false);
  useEffect(
    function () {
      const scope = sc && inputRef.current && inputRef.current.closest<HTMLElement>(".r1-shell");
      const off = singleKeyOff(sc, scope, singleOn);
      if (scOff[0] !== off) scOff[1](off);
      bound[1](!!scope && !off);
      if (!scope || off) return undefined;
      function onKey(e: KeyboardEvent): void {
        if (keyTaken(e)) return;
        if (!shortcutHit(e, sc!)) return;
        if (!sc!.mod && !sc!.alt && isTyping(e.target)) return;
        takeKey(e);
        e.stopPropagation();
        focusEl(inputRef.current);
        if (inputRef.current) inputRef.current.select();
      }
      scope.addEventListener("keydown", onKey);
      return function () {
        scope.removeEventListener("keydown", onKey);
      };
    },
    [sc ? (sc.mod ? "mod+" : "") + (sc.alt ? "alt+" : "") + sc.key : "", singleOn],
  );
  useEffect(
    function () {
      if (first.current) {
        first.current = false;
        return;
      }
      if (busy) announce(t.search.searching);
      else if (!isNil(p.resultCount)) announce(resultWords(p.resultCount, t.search));
    },
    [busy, p.resultCount],
  );
  function set(v: string, e: React.SyntheticEvent): void {
    st[1](v);
    if (p.onChange) p.onChange(v, e);
  }
  const size = fieldIconSize(p);
  const control = (
    <div className={cx("r1-search", "r1-search--" + (p.density || "portal"))} role="search">
      <Icon name="search" size={size} className="r1-search__icon" />
      <input
        ref={inputRef}
        id={id}
        name={p.name}
        type="search"
        className="r1-input r1-search__input"
        value={val}
        placeholder={p.placeholder}
        autoComplete="off"
        disabled={p.disabled}
        required={p.required}
        aria-invalid={p.error ? "true" : undefined}
        aria-busy={busy ? "true" : undefined}
        aria-keyshortcuts={bound[0] ? (sc!.mod || sc!.alt ? shortcutAria(sc!) : sc!.key) : undefined}
        data-r1-shortcut={sc ? shortcutText(p.shortcut, sc) : undefined}
        data-r1-shortcut-label={sc ? textOf(p.label) : undefined}
        data-r1-shortcut-off={sc && scOff[0] ? "" : undefined}
        aria-describedby={describedBy(p, id)}
        onBlur={p.onBlur}
        onChange={function (e) {
          set(e.target.value, e);
        }}
        onKeyDown={function (e) {
          if (e.key === "Enter" && p.onSearch) {
            e.preventDefault();
            p.onSearch(val, e);
          } else if (e.key === "Escape" && val) {
            e.preventDefault();
            set("", e);
          }
        }}
      />
      {busy ? (
        <span className="r1-search__end">
          <Icon name="loader-circle" size={size} spin={true} label={t.search.searching} />
        </span>
      ) : val && !p.disabled ? (
        <button
          type="button"
          className="r1-search__clear"
          aria-label={t.search.clear}
          onClick={function (e) {
            set("", e);
            focusEl(inputRef.current);
          }}
        >
          <Icon name="x" size={size} />
        </button>
      ) : sc && !scOff[0] ? (
        <kbd className="r1-search__kbd" aria-hidden="true">
          {shortcutText(p.shortcut, sc)}
        </kbd>
      ) : null}
    </div>
  );
  const box = (
    <div className="r1-field__control" style={p.width ? { maxWidth: p.width } : undefined}>
      {control}
    </div>
  );
  return fieldShell(sizedField(p), id, box);
}

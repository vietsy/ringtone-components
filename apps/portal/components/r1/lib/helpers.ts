"use client";

import * as React from "react";
import { useRef, useState } from "react";

/** The class names that apply, joined by a space: falsy entries are left out. */
export function cx(...names: Array<string | false | null | undefined | 0>): string {
  return names.filter(Boolean).join(" ");
}

export function useUid(prefix?: string): string {
  return (prefix || "r1") + "-" + React.useId().replace(/[^\w-]/g, "");
}

export function isNil(v: unknown): v is null | undefined {
  return v === null || v === undefined;
}

export function lang(locale?: string | null): "vi" | "en" {
  return locale === "en" ? "en" : "vi";
}

export function pad2(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

// The value a control shows: its own state, reset whenever the page passes a new value.
// Compare by a string key when the value is an array or object built afresh on each render.
export function useSynced<T>(value: T | null | undefined, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const st = useState<T>(isNil(value) ? fallback : value);
  const last = useRef(value);
  if (value !== last.current) {
    last.current = value;
    if (!isNil(value) && value !== st[0]) st[1](value);
  }
  return st;
}

// The latest props, for handlers registered once in an effect.
export function useLatest<T>(v: T): React.RefObject<T> {
  const r = useRef(v);
  r.current = v;
  return r;
}

// Focus moves only after the reader did something. A specimen drawn open on a design canvas,
// where nothing on the page has focus, never takes it.
export function readerActed(): boolean {
  const a = document.activeElement;
  return !!a && a !== document.body && a !== document.documentElement;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root: ParentNode | null | undefined): HTMLElement[] {
  return root
    ? (Array.prototype.filter.call(root.querySelectorAll<HTMLElement>(FOCUSABLE), function (e: HTMLElement) {
        return e.getClientRects().length > 0;
      }) as HTMLElement[])
    : [];
}

/** An element that may take focus: an HTML or an SVG element has focus(); any other element is passed over. */
type MaybeFocusable = Element & Partial<Pick<HTMLOrSVGElement, "focus">>;

export function focusEl(el: MaybeFocusable | null | undefined): void {
  if (el && el.focus) el.focus({ preventScroll: true });
}

// el: the target of a key or pointer event, or the element that has focus.
export function isTyping(el: EventTarget | null | undefined): boolean {
  return (
    !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test((el as Element).tagName) || (el as HTMLElement).isContentEditable)
  );
}

export function isControl(el: EventTarget | null | undefined): boolean {
  return (
    isTyping(el) ||
    (!!el && (/^(BUTTON|A)$/.test((el as Element).tagName) || (el as Element).getAttribute("role") === "slider"))
  );
}

// Screen-reader announcements go through regions that are on the page before anything is said into
// them; a region created together with its text is often not read.
export type LiveKind = "polite" | "assertive";

function liveRegion(kind: LiveKind): Element | null {
  if (typeof document === "undefined" || !document.body) return null;
  let el = document.querySelector('[data-r1-live="' + kind + '"]');
  if (!el) {
    el = document.createElement("div");
    el.setAttribute("data-r1-live", kind);
    el.setAttribute("aria-live", kind);
    el.setAttribute("aria-atomic", "true");
    el.className = "r1-sr";
    document.body.appendChild(el);
  }
  return el;
}

function ensureLive(): void {
  liveRegion("polite");
  liveRegion("assertive");
}

if (typeof document !== "undefined") {
  if (document.body) ensureLive();
  else document.addEventListener("DOMContentLoaded", ensureLive);
}

export function announce(text: string | null | undefined, kind?: LiveKind): void {
  const el = liveRegion(kind || "polite");
  if (!el || !text) return;
  el.textContent = "";
  setTimeout(function () {
    el.textContent = text;
  }, 100);
}

// Join sentences for one announcement: a part that already ends a sentence is not given a second stop.
export function joinSentences(parts: string[]): string {
  return parts.filter(Boolean).reduce(function (a, b) {
    return a ? a + (/[.!?\u2026:]$/.test(a) ? " " : ". ") + b : b;
  }, "");
}

/** A React element, read for the words of its children. */
type ElementWithChildren = React.ReactElement<{ children?: React.ReactNode }>;

export function textOf(node: React.ReactNode): string {
  if (isNil(node) || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  return (node as ElementWithChildren).props ? textOf((node as ElementWithChildren).props.children) : "";
}

// Matching that ignores Vietnamese marks and case: "ha noi" finds "Hà Nội".
export function fold(s: string | null | undefined): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();
}

// A noun put at the start of a sentence: "gi\u1ea5y x\u00e1c nh\u1eadn" opens "Gi\u1ea5y x\u00e1c nh\u1eadn h\u1ee3p l\u1ec7\u2026".
function capFirst(s: string | null | undefined): string {
  s = String(s || "");
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

// A default sentence that names the record only when the page names it (recordNoun); otherwise the neutral one.
export function nounText(neutral: string, withNoun: string, noun?: string | null): string {
  if (!noun) return neutral;
  return withNoun.replace("{Noun}", capFirst(noun)).replace("{noun}", String(noun));
}

// Developer messages for a binding the system refuses or a key list that names a key nothing binds. Said once each.
const warned: Record<string, boolean> = {};

export function warnOnce(msg: string): void {
  if (warned[msg]) return;
  warned[msg] = true;
  if (typeof console !== "undefined" && console.warn) console.warn("R1: " + msg);
}

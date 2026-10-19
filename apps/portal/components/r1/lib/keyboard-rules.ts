"use client";

import { useEffect, useState } from "react";
import { warnOnce } from "./helpers";
import { parseShortcut } from "./search-and-pick";
import type { Shortcut } from "./search-and-pick";

// A single-character key bound on a shell ("/", "?", a bare letter on a Button or a FilterBar) fires from anywhere in
// that shell, so a reader who types by voice or slips on the keyboard can set it off without meaning to (WCAG 2.1.4).
// The reader turns these keys off in the shell's key list, and the choice is kept in this browser. A page turns them
// off for everyone with ConsoleShell singleKeys="off" (the shell carries data-r1-single-keys="off"). Keys that act only
// while their own component has focus (a table's J and K, a queue's arrows) are not shell keys and stay on.
export const SINGLE_KEY_STORE = "r1-single-keys";

export const singleKeys: { on: boolean; subs: Array<(on: boolean) => void> } = { on: true, subs: [] };

try {
  singleKeys.on = window.localStorage.getItem(SINGLE_KEY_STORE) !== "off";
} catch {
  /* storage refused: keys stay on */
}

export function useSingleKeys(): boolean {
  const st = useState(singleKeys.on);
  useEffect(function () {
    function follow(v: boolean) {
      st[1](v);
    }
    singleKeys.subs.push(follow);
    if (st[0] !== singleKeys.on) st[1](singleKeys.on);
    return function () {
      const i = singleKeys.subs.indexOf(follow);
      if (i >= 0) singleKeys.subs.splice(i, 1);
    };
  }, []);
  return st[0];
}

function isSingleKey(sc: Shortcut | null): boolean {
  return !!sc && !sc.mod && !sc.alt && sc.key.length === 1;
}

// Whether a shell key is off: the reader's choice, or the page's for the shell it sits in.
export function singleKeyOff(sc: Shortcut | null, scope: Element | null | undefined, on: boolean): boolean {
  return isSingleKey(sc) && (!on || (!!scope && scope.getAttribute("data-r1-single-keys") === "off"));
}

// Alt+D, Alt+E and Alt+F belong to the browser (the address bar; Chrome and Edge open their menu on E as on F):
// a binding asking for one is refused, says so once in the console, and is neither bound, drawn nor listed.
const ALT_OWNED: Readonly<Record<string, string>> = { d: "Alt+D", e: "Alt+E", f: "Alt+F" };

export function bindableShortcut(raw: string | null | undefined, owner: string): Shortcut | null {
  const sc = parseShortcut(raw);
  if (sc && sc.alt && !sc.mod && ALT_OWNED[sc.key]) {
    warnOnce(
      ALT_OWNED[sc.key] +
        " is not bound on " +
        owner +
        ": the browser uses it. Choose another Alt+letter (Alt+N opens a new form, Alt+S saves a draft).",
    );
    return null;
  }
  return sc;
}

// An Alt+letter that matches stops the browser's menu even when the action declines (disabled, working, or in another
// dialog), so defaultPrevented alone no longer means another binding took the key: r1Took says that.
export type ShellKeyEvent = KeyboardEvent & { r1Took?: boolean | undefined; r1Alt?: boolean | undefined };

export function keyTaken(e: ShellKeyEvent): boolean {
  return !!e.r1Took || (e.defaultPrevented && !e.r1Alt);
}

export function holdAlt(e: ShellKeyEvent, sc: Shortcut): void {
  if (sc.alt && !e.defaultPrevented) {
    e.preventDefault();
    e.r1Alt = true;
  }
}

export function takeKey(e: ShellKeyEvent): void {
  e.preventDefault();
  e.r1Took = true;
}

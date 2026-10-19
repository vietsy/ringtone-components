"use client";

// Search on Enter (onSearch) or as the reader types (onChange). loading (busy in older frames) and resultCount
// are said to screen readers when they change; clearing empties the box and puts focus back in it.
/** The words for a result count; {n} in results is the count. */
export interface ResultWords {
  noResults: string;
  oneResult?: string | undefined;
  results: string;
}

export function resultWords(n: number, words: ResultWords): string {
  if (n === 0) return words.noResults;
  if (n === 1 && words.oneResult) return words.oneResult;
  return words.results.replace("{n}", String(n));
}

// The shortcut as drawn ("⌘K", "Ctrl+K", "/", "Alt+R", "⌥R"): a modifier (Cmd or Ctrl) or none, Alt (Option) or not,
// and one key.
export interface Shortcut {
  mod: boolean;
  alt: boolean;
  key: string;
}

export function parseShortcut(s: string | null | undefined): Shortcut | null {
  const str = String(s || "");
  const key = str.replace(/\u2318|\u21e7|\u2325|cmd|ctrl|control|meta|mod|shift|alt|option|\+|\s/gi, "").toLowerCase();
  return key
    ? { mod: /\u2318|cmd|ctrl|control|meta|mod/i.test(str), alt: /\u2325|alt|option/i.test(str), key: key }
    : null;
}

// Apple keyboards name Alt Option and draw it as the sign U+2325.
// userAgentData is not in every browser, nor in TypeScript's DOM types.
type NavigatorWithUAData = Navigator & { userAgentData?: { platform?: string | undefined } | undefined };

function applePlatform(): boolean {
  try {
    const nav: Partial<NavigatorWithUAData> = window.navigator || {};
    return /mac|iphone|ipad|ipod/i.test(
      (nav.userAgentData && nav.userAgentData.platform) || nav.platform || nav.userAgent || "",
    );
  } catch {
    return false;
  }
}

// Whether a keydown is the shortcut. Cmd or Ctrl must match the shortcut's own modifier; a shortcut without one fires
// only with neither held. Alt is required when the shortcut names it and refused on a bare key. Option with a letter
// types another character on a Mac (Option+R is the registered sign), so with Alt the physical key (KeyR, Digit1) is
// compared too.
export function shortcutHit(e: KeyboardEvent, sc: Shortcut): boolean {
  if (sc.mod ? !(e.metaKey || e.ctrlKey) : e.metaKey || e.ctrlKey) return false;
  if (sc.alt ? !e.altKey : !sc.mod && e.altKey) return false;
  if (String(e.key).toLowerCase() === sc.key) return true;
  return sc.alt && sc.key.length === 1 && e.code === (/\d/.test(sc.key) ? "Digit" : "Key") + sc.key.toUpperCase();
}

// What aria-keyshortcuts says: "N"; "Control+S Meta+S" with a modifier; "Alt+R"; "Control+Alt+R Meta+Alt+R".
export function shortcutAria(sc: Shortcut): string {
  const k = sc.key.length === 1 ? sc.key.toUpperCase() : sc.key;
  const a = sc.alt ? "Alt+" : "";
  return sc.mod ? "Control+" + a + k + " Meta+" + a + k : a + k;
}

// A shortcut with Alt is drawn the platform's way: Option's sign and the key on a Mac, an iPhone or an iPad ("⌥R"),
// "Alt+R" elsewhere (with Cmd or Ctrl: "⌘⌥R", "Ctrl+Alt+R"). Every other shortcut is drawn as the page wrote it.
export function shortcutText(raw: string | undefined, sc: Shortcut | null): string | undefined {
  if (!sc || !sc.alt) return raw;
  const k = sc.key.length === 1 ? sc.key.toUpperCase() : sc.key;
  return applePlatform() ? (sc.mod ? "\u2318" : "") + "\u2325" + k : (sc.mod ? "Ctrl+" : "") + "Alt+" + k;
}

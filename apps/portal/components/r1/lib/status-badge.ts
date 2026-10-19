"use client";

import type * as React from "react";
import { lang, textOf } from "./helpers";
import { tx } from "./strings";
import type { Locale } from "./types";

// working: a state that is running now (an import, a recomputation). The spinning loader-circle takes the place of
// the family's shape, at the same size and on the same line; it stands still under prefers-reduced-motion (.r1-spin).
// A screen reader hears "in progress" after the label unless the label already says so ("Đang chạy", "Running").
export function workingWords(label: React.ReactNode, locale: Locale | undefined): string | null {
  const t = tx(locale).badge;
  const s = String(textOf(label) || "")
    .normalize("NFC")
    .toLocaleLowerCase(lang(locale));
  const mark = t.workingMark.toLocaleLowerCase(lang(locale));
  const said =
    (" " + s.replace(/[\s,.;:!?()–—-]+/g, " ") + " ").indexOf(" " + mark + " ") >= 0 ||
    (lang(locale) === "en" && /^\s*[a-z]+ing\b/.test(s));
  return said ? null : ", " + t.working;
}

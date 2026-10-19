"use client";

import type * as React from "react";
import { cx, lang } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type LangToggleProps = {
  locale?: Locale | undefined;
  onChange?: ((l: Locale) => void) | undefined;
  density?: "console" | "portal" | "premises" | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// VI | EN on screen, "Tiếng Việt" and "English" to a screen reader, each name in its own language.
// density: portal and premises (the default) are 44 px touch targets; console is 32 px.
export function LangToggle(p: LangToggleProps) {
  const t = tx(p.locale);
  const cur = lang(p.locale);
  return (
    <div
      className={cx("r1-lang", "r1-lang--" + (p.density || "portal"), p.className)}
      role="group"
      aria-label={t.shell.language}
      style={p.style}
    >
      {(["vi", "en"] satisfies Locale[]).map(function (l) {
        return (
          <button
            key={l}
            type="button"
            className="r1-lang__btn"
            aria-pressed={cur === l ? "true" : "false"}
            lang={l}
            aria-label={t.langs[l]}
            onClick={
              p.onChange
                ? function () {
                    p.onChange!(l);
                  }
                : undefined
            }
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

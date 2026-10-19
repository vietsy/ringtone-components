"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";
import { StatusIcon } from "./StatusIcon";
import { announce, cx, joinSentences, readerActed, textOf } from "./lib/helpers";
import { STATUS_FAMILIES } from "./lib/icons";
import { tx } from "./lib/strings";
import type { Family, Locale } from "./lib/types";

export type StatusLineProps = {
  family?: Family | undefined;
  text?: React.ReactNode | undefined;
  detail?: React.ReactNode | undefined;
  cutout?: string | undefined;
  live?: boolean | undefined;
  role?: string | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// One status in a line of text: the shape, the words, and one line of detail. Lighter than a Banner.
// Not a live region: a line drawn with the page is read in order. When its text changes, or it appears after
// the reader acted, it is said once with its family in words ("Cần chú ý: ..."); live forces it on or off,
// and an explicit role makes the line its own live region instead.
export function StatusLine(p: StatusLineProps) {
  const t = tx(p.locale);
  const family: Family = STATUS_FAMILIES.indexOf(p.family as Family) >= 0 ? p.family! : "info";
  const text = textOf(p.text || p.children);
  const first = useRef(true);
  useEffect(
    function () {
      const mount = first.current;
      first.current = false;
      if (p.role || p.live === false || !text) return;
      if (p.live === true || !mount || readerActed())
        announce(
          t.status[family] + ": " + joinSentences([text, textOf(p.detail)]),
          family === "danger" ? "assertive" : "polite",
        );
    },
    [text],
  );
  return (
    <p className={cx("r1-sline", "r1-sline--" + family, p.className)} role={p.role} style={p.style}>
      <StatusIcon family={family} size={20} cutout={p.cutout || "page"} />
      <span className="r1-sline__body">
        <span className="r1-sline__text">
          <span className="r1-sr">{t.status[family] + ": "}</span>
          {p.text || p.children}
        </span>
        {p.detail ? <span className="r1-sline__detail">{p.detail}</span> : null}
      </span>
    </p>
  );
}

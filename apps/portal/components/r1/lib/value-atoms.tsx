"use client";

import type * as React from "react";
import { cx, isNil } from "./helpers";

/** The two sizes Figma draws MoneyValue, CountValue and DateValue at: md is Product/text-base, sm Product/text-sm. */
export type ValueSize = "md" | "sm";

// A value's own size, when a screen sets one; with none the value takes its container's type, as a table cell or a
// fact sets it. Only the size and its leading: the ink and the weight stay the container's.
export function valueSizeClass(size: ValueSize | undefined): string | null {
  return size === "md" || size === "sm" ? "r1-value--" + size : null;
}

// A value the system does not have: a dash read aloud as words, or the page's own words when it says why
// ("Chưa cấp"). Never 0, never blank.
export function missingValue(
  missing: string | null | undefined,
  words: string,
  className?: string,
): React.ReactElement {
  if (!isNil(missing) && missing !== "") return <span className={cx("r1-null", className)}>{missing}</span>;
  return (
    <span className={cx("r1-null", className)}>
      <span aria-hidden="true">–</span>
      <span className="r1-sr">{words}</span>
    </span>
  );
}

// A date never breaks inside itself ("31 / tháng 12"): a line may break only between a date and its time, and
// between the two ends of a period.
export function keepTogether(s: string): string {
  return s
    .split(" – ")
    .map(function (part) {
      return part
        .replace(/ /g, "\u00a0")
        .replace(/,\u00a0(\d{2}:\d{2})/, ", $1")
        .replace(/\u00a0đến\u00a0/, " đến ");
    })
    .join(" – ");
}

// Copying says what happened: "Đã sao chép R1-…" to a screen reader and a tick on the button, or, when the
// browser refuses, the reference selected for the reader to copy and a line saying it was not copied.
// mask: every character but the last four is a dot (separators keep their place, so the shape holds), and a Show
// button reveals the whole value; copy still copies the whole value, and nothing read aloud gives it away while hidden.
// tail: only the last n characters after an ellipsis, for a dense column; the whole value is its accessible name and
// its title, and it shows whole while it has focus. mask wins over tail.
const ID_SEPARATOR = /[\s\-./_:]/;

export function idChars(v: string): string {
  return v
    .split("")
    .filter(function (c) {
      return !ID_SEPARATOR.test(c);
    })
    .join("");
}

// A value of four characters or fewer is hidden whole.
export function maskValue(v: string): string {
  let show = idChars(v).length > 4 ? 4 : 0,
    out = "";
  for (let i = v.length - 1; i >= 0; i--) {
    const c = v.charAt(i);
    if (ID_SEPARATOR.test(c)) {
      out = c + out;
      continue;
    }
    out = (show > 0 ? c : "\u2022") + out;
    show -= 1;
  }
  return out;
}

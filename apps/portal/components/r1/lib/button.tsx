"use client";

import type * as React from "react";

// Icons sit on the 4 px grid: 16 px in a sm button (text-sm), 20 px in md, lg and xl.
// shortcut: one key ("N", or "⌘S" with a modifier) that presses the button from anywhere in its shell. Like
// SearchField's, it is bound on the nearest .r1-shell, never on the document; a bare key never fires while the reader
// types in a field or from inside a dialog the button is not in, nor while the button is disabled or working. Bound,
// it sets aria-keyshortcuts; data-r1-shortcut marks it from the first render, so ConsoleShell's list of keys shows it.
// A reference in a label that wraps stays on one line ("Mở quyết định OBD-2YDA7KMS5X" breaks before the code, never
// after its hyphen): a word of capitals and digits joined by - / . that carries a digit is kept whole, with the
// bracket or quote that opens or closes it ("(ARR-2026-01)", "“OBD-3FJW6NRA5C”"), so the line breaks before the bracket.
const REF_WORD = /^[([{“‘«"']*[A-Z0-9]+(?:[-/.][A-Z0-9]+)+[)\]}”’»"',.;:?!]*$/;

export function keepRefs(label: React.ReactNode): React.ReactNode {
  if (typeof label !== "string" || (label.indexOf("-") < 0 && label.indexOf("/") < 0)) return label;
  // The words around a reference stay one run of text, so a label that fits is laid out exactly as a plain string.
  const out: React.ReactNode[] = [];
  let run = "";
  label.split(/(\s+)/).forEach(function (w, i) {
    if (REF_WORD.test(w) && /\d/.test(w)) {
      if (run) out.push(run);
      run = "";
      out.push(
        <span key={i} className="r1-nowrap">
          {w}
        </span>,
      );
    } else run += w;
  });
  if (run) out.push(run);
  // One inline run, so a flex parent (a fact value, a toast) lays the words and the reference out as one line of text.
  return out.length > 1 || typeof out[0] !== "string" ? <span>{out}</span> : label;
}

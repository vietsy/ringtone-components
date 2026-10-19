"use client";

import type * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";

// A modal dialog manages focus once the reader opens it: focus moves to its title (decision of 7 October 2026),
// Tab stays inside, Escape closes, and focus goes back to what opened it. placement 'viewport' fixes it
// to the window and makes the rest of the page inert; 'overlay' covers the nearest positioned container.
// Every dialog has a way out: the close button, the secondary action and Escape call onClose; without
// onClose (and without a controlled open) the dialog closes itself.
// Actions follow the form rule: the primary action first, at the bottom left, then the way out beside it.
// A layer portalled to <body> leaves the frame that set data-theme; it reads the theme where it is mounted and carries it.
export function useHostTheme(on: boolean): { ref: React.RefObject<HTMLSpanElement | null>; theme: string | null } {
  const markRef = useRef<HTMLSpanElement>(null);
  const st = useState<string | null>(null);
  useLayoutEffect(function () {
    if (!on || !markRef.current) return;
    const el = markRef.current.parentElement && markRef.current.parentElement.closest("[data-theme]");
    const v = el ? el.getAttribute("data-theme") : null;
    if (v !== st[0]) st[1](v);
  });
  return { ref: markRef, theme: st[0] };
}

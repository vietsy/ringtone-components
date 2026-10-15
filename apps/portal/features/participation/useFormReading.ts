"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * What a form says now, re-read as the person fills it in: the page renders R1's fields, each keeping its own
 * value, and this reads them all back through the form's data after every input, change, click and key. A date
 * picked from the calendar changes its field without an input event, hence the clicks and keys. `initial` is
 * the same reading as the server renders it, so the first paint and the browser's agree.
 *
 * `same` compares two readings, so an unchanged reading does not render the form again.
 */
export function useFormReading<T>(
  read: (data: FormData) => T,
  initial: T,
  same: (a: T, b: T) => boolean,
): [RefObject<HTMLFormElement | null>, T, () => void] {
  const form = useRef<HTMLFormElement>(null);
  const [reading, setReading] = useState<T>(initial);
  const latest = useRef({ read, same });
  latest.current = { read, same };
  const timer = useRef<number | undefined>(undefined);
  const reread = () => {
    window.clearTimeout(timer.current);
    // After the field's own update has rendered.
    timer.current = window.setTimeout(() => {
      const element = form.current;
      if (element === null) return;
      const next = latest.current.read(new FormData(element));
      setReading((before) => (latest.current.same(before, next) ? before : next));
    }, 0);
  };
  useEffect(() => {
    const element = form.current;
    if (element === null) return undefined;
    const events = ["input", "change", "click", "keyup", "focusout"] as const;
    for (const event of events) element.addEventListener(event, reread);
    reread();
    return () => {
      window.clearTimeout(timer.current);
      for (const event of events) element.removeEventListener(event, reread);
    };
    // Attached once: the listeners read the latest `read` through the ref.
  }, []);
  return [form, reading, reread];
}

/** Two readings made of plain values (strings, numbers, arrays and objects of them) are the same. */
export const sameReading = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

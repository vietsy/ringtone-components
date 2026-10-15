"use client";

import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/r1";
import { SubmitButton } from "./SubmitButton";

/** The required fields still empty, as the form around a submit reads them now. */
const Missing = createContext<readonly string[]>([]);

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((name, index) => b[index] === name);

/**
 * A form whose primary submit waits for its required fields: the board draws Start and Next unavailable, with
 * the reason beside them, until each is answered (convention 14). The page renders the fields; this reads them
 * as the person fills them in. A date picked from the calendar changes its field without an input event, so
 * the fields are read again after every click and key as well.
 *
 * The browser's own check is off (`noValidate`): Save and leave sends what is answered so far, and the server
 * answers every value it is sent.
 */
export function GatedForm({
  action,
  required,
  initiallyMissing,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  /** The fields a submit waits for, by name. */
  required: readonly string[];
  /** The same as the server renders it, so the first paint and the browser's agree. */
  initiallyMissing: readonly string[];
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [missing, setMissing] = useState<readonly string[]>(initiallyMissing);
  useEffect(() => {
    const element = form.current;
    if (element === null) return undefined;
    let timer: number | undefined;
    const read = () => {
      window.clearTimeout(timer);
      // After the field's own update has rendered.
      timer = window.setTimeout(() => {
        const data = new FormData(element);
        const empty = required.filter((name) => {
          const value = data.get(name);
          return typeof value !== "string" || value.trim() === "";
        });
        setMissing((before) => (same(before, empty) ? before : empty));
      }, 0);
    };
    const events = ["input", "change", "click", "keyup", "focusout"] as const;
    for (const event of events) element.addEventListener(event, read);
    read();
    return () => {
      window.clearTimeout(timer);
      for (const event of events) element.removeEventListener(event, read);
    };
  }, [required]);
  return (
    <form ref={form} action={action} noValidate>
      <Missing.Provider value={missing}>{children}</Missing.Provider>
    </form>
  );
}

type SubmitProps = Omit<ComponentProps<typeof SubmitButton>, "disabled" | "disabledReason">;

/**
 * The form's primary submit, unavailable while a required field is empty: the first reason whose field is
 * empty is said beside it. A rule that stops the form altogether (blocked) wins over every field.
 */
export function GatedSubmit({
  reasons,
  blocked = null,
  ...props
}: SubmitProps & { reasons: readonly { field: string; text: string }[]; blocked?: string | null }) {
  const missing = useContext(Missing);
  const reason = blocked ?? reasons.find((entry) => missing.includes(entry.field))?.text ?? null;
  return <SubmitButton {...props} disabled={reason !== null} {...(reason !== null ? { disabledReason: reason } : {})} />;
}

/**
 * A second submit that says what the form is for: it sets the form's `intent` field before the form is sent,
 * as Save and leave does on SCR-REG-03. It never waits for the required fields.
 */
export function IntentSubmit({ intent, ...props }: Omit<ComponentProps<typeof Button>, "type" | "onClick" | "href"> & { intent: string }) {
  const mark = (event: unknown) => {
    const button = (event as { currentTarget?: unknown }).currentTarget;
    const field = button instanceof HTMLButtonElement ? button.form?.elements.namedItem("intent") : null;
    if (field instanceof HTMLInputElement) field.value = intent;
  };
  return <Button {...props} type="submit" onClick={mark} />;
}

"use client";

import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/r1";

/** The required fields still empty, as the form around a submit reads them now. */
const Missing = createContext<readonly string[]>([]);

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((name, index) => b[index] === name);

/**
 * A case form whose act waits for its required fields - SCR-CAS-01's Raise the case for the group, the matter and
 * the contact, the console's for theirs - with the reason it waits said beside it (convention 3). The page renders
 * the fields; this reads them as the person types. The browser's own check is off: the server answers every value
 * it is sent.
 */
export function RequiredForm({
  id,
  action,
  required,
  initiallyMissing,
  children,
}: {
  /** For a confirmed act whose dialog sends this form by its id. */
  id?: string;
  action: (formData: FormData) => Promise<void>;
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
    const events = ["input", "change", "keyup", "focusout"] as const;
    for (const event of events) element.addEventListener(event, read);
    read();
    return () => {
      window.clearTimeout(timer);
      for (const event of events) element.removeEventListener(event, read);
    };
  }, [required]);
  return (
    <form ref={form} {...(id !== undefined ? { id } : {})} action={action} noValidate>
      <Missing.Provider value={missing}>{children}</Missing.Provider>
    </form>
  );
}

/** The required fields of the form around a control that are still empty: none outside a RequiredForm. */
export const useMissingFields = (): readonly string[] => useContext(Missing);

type SubmitProps = Omit<ComponentProps<typeof Button>, "type" | "loading" | "href" | "onClick" | "disabled" | "disabledReason">;

/**
 * The form's submit, unavailable while a required field is empty, with the first such field's reason beside it;
 * `blocked` (the route needs an account the reader has not signed in with) wins over every field. It works while
 * the form's server action runs.
 */
export function RequiredSubmit({ reasons, blocked = null, ...props }: SubmitProps & { reasons: readonly { field: string; text: string }[]; blocked?: string | null }) {
  const missing = useContext(Missing);
  const status = useFormStatus();
  const reason = blocked ?? reasons.find((entry) => missing.includes(entry.field))?.text ?? null;
  return <Button {...props} type="submit" loading={status.pending} disabled={reason !== null} {...(reason !== null ? { disabledReason: reason } : {})} />;
}

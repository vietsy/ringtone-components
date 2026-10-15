"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, Divider, Panel, VerificationResult, ViewState } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** What Ask waits for, by the names R1's fields send them under: the premises chosen and the moment. */
const QUESTION = ["premises_id", "at"] as const;

/** Whether both are given, as the form around Ask reads them now. */
const Complete = createContext(false);

/** Sends the question again as it stands, for Try again. */
const Resend = createContext<() => void>(() => undefined);

/**
 * SCR-PTY-17's question as a form. Ask stays unavailable until a premises and a moment are both given (PTY 03,
 * "Choose a premises and a moment first."); the fields are read as the person fills them. A premises picked from
 * the list and a day picked from the calendar change their fields without an input event, so the form reads
 * them again after every click and key as well.
 */
export function AskForm({
  action,
  initiallyComplete,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  /** As the server renders the question, so the first paint and the browser's agree. */
  initiallyComplete: boolean;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [complete, setComplete] = useState(initiallyComplete);
  useEffect(() => {
    const element = form.current;
    if (element === null) return undefined;
    let timer: number | undefined;
    const read = () => {
      window.clearTimeout(timer);
      // After the field's own update has rendered.
      timer = window.setTimeout(() => {
        const data = new FormData(element);
        setComplete(QUESTION.every((name) => {
          const value = data.get(name);
          return typeof value === "string" && value.trim() !== "";
        }));
      }, 0);
    };
    const events = ["input", "change", "click", "keyup", "focusout"] as const;
    for (const event of events) element.addEventListener(event, read);
    read();
    return () => {
      window.clearTimeout(timer);
      for (const event of events) element.removeEventListener(event, read);
    };
  }, []);
  const resend = () => form.current?.requestSubmit();
  return (
    <form ref={form} action={action} noValidate>
      <Complete.Provider value={complete}>
        <Resend.Provider value={resend}>{children}</Resend.Provider>
      </Complete.Provider>
    </form>
  );
}

/** Ask: unavailable with its reason until the question is complete, working while the register is asked. */
export function AskButton({
  label,
  loadingLabel,
  reason,
  pending = false,
  locale,
}: {
  label: string;
  loadingLabel: string;
  reason: string;
  /** The board's checking view: drawn working with no sending in flight. */
  pending?: boolean;
  locale: Locale;
}) {
  const complete = useContext(Complete);
  const status = useFormStatus();
  return (
    <Button
      variant="primary"
      size="md"
      type="submit"
      disabled={!complete}
      {...(!complete ? { disabledReason: reason } : {})}
      loading={pending || status.pending}
      loadingLabel={loadingLabel}
      locale={locale}
    >
      {label}
    </Button>
  );
}

/**
 * The answer area: while the question is with the register, the board's checking state; otherwise what the page
 * drew there (an earlier refusal or failure), or nothing before anything is asked.
 */
export function AnswerArea({
  title,
  checkingText,
  checking = false,
  locale,
  children,
}: {
  title: string;
  checkingText: string;
  /** The board's checking view, drawn with no sending in flight. */
  checking?: boolean;
  locale: Locale;
  children?: ReactNode;
}) {
  const status = useFormStatus();
  if (!checking && !status.pending) return <>{children}</>;
  return (
    <>
      <Divider />
      <Panel variant="plain" title={title} density="portal" locale={locale}>
        <VerificationResult result="checking" title={checkingText} locale={locale} />
      </Panel>
    </>
  );
}

/**
 * The register did not answer: no answer is shown, only the trace. Try again sends the question again as it
 * stands; R1's own Try again would reload the page, which shows the same failure the last attempt kept.
 */
export function NoAnswer({ title, text, traceId, locale }: { title: string; text: string; traceId: string | null; locale: Locale }) {
  const resend = useContext(Resend);
  return (
    <ViewState
      view="error"
      errorTitle={title}
      errorText={text}
      {...(traceId !== null ? { traceId } : {})}
      onRetry={resend}
      density="portal"
      locale={locale}
    />
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { Button, ButtonRow, Dialog, Panel, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * SCR-CAT-24's form: the reason, Cancel the submission and Keep processing. Cancelling waits for a reason (1 to
 * 500 characters) and says so; pressed, it asks first, naming what is lost, because cancelling is final and the
 * reference cannot be reused. Confirmed, the form is sent with the reason.
 *
 * The board puts the destructive button first on a desktop and last on a phone, where the two stack.
 */
export function CancelSubmissionForm({
  copy,
  action,
  initialReason,
  refusal,
  initiallyOpen,
  keepHref,
  phone,
  locale,
}: {
  copy: {
    reasonTitle: string;
    reason: string;
    reasonHelp: string;
    cancel: string;
    keep: string;
    missing: string;
    title: string;
    text: string;
    confirm: string;
    back: string;
  };
  action: (formData: FormData) => Promise<void>;
  initialReason: string;
  /** FIELD_MISSING's sentence when a sent reason was refused. */
  refusal: string | null;
  /** The canvas's confirm view: the dialog drawn open on arrival. */
  initiallyOpen: boolean;
  keepHref: string;
  phone: boolean;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [reason, setReason] = useState(initialReason);
  const [open, setOpen] = useState<"on-arrival" | "by-person" | null>(initiallyOpen ? "on-arrival" : null);
  const [cancelling, startCancelling] = useTransition();
  const empty = reason.trim() === "";
  const cancelButton = (
    <Button
      variant="secondary"
      size="md"
      fullWidth={phone}
      disabled={empty}
      {...(empty ? { disabledReason: copy.missing } : {})}
      onClick={() => setOpen("by-person")}
      locale={locale}
    >
      {copy.cancel}
    </Button>
  );
  const keepButton = (
    <Button variant="quiet" size="md" fullWidth={phone} href={keepHref} locale={locale}>
      {copy.keep}
    </Button>
  );
  return (
    <form ref={form} action={action} noValidate>
      <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Panel variant="plain" level={2} title={copy.reasonTitle} density="portal" locale={locale}>
          <TextField
            label={copy.reason}
            helper={copy.reasonHelp}
            value={reason}
            onChange={(value: string) => setReason(value)}
            multiline
            rows={2}
            maxLength={500}
            required
            name="reason"
            {...(refusal !== null && reason === initialReason ? { error: refusal } : {})}
            locale={locale}
          />
        </Panel>
        <ButtonRow>
          {phone ? keepButton : cancelButton}
          {phone ? cancelButton : keepButton}
        </ButtonRow>
      </Panel>
      {open !== null ? (
        <Dialog
          title={copy.title}
          description={copy.text}
          primaryAction={{
            label: copy.confirm,
            variant: "danger",
            loading: cancelling,
            onClick: () => startCancelling(() => form.current?.requestSubmit()),
          }}
          secondaryAction={{ label: copy.back, onClick: () => setOpen(null) }}
          onClose={() => setOpen(null)}
          open
          placement={open === "on-arrival" ? "overlay" : "viewport"}
          align="start"
          autoFocus={open === "by-person"}
          density="portal"
          width={phone ? "100%" : "var(--container-xl)"}
          locale={locale}
        />
      ) : null}
    </form>
  );
}

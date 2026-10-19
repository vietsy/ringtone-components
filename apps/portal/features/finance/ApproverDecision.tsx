"use client";

import { useRef, useState, useTransition } from "react";
import { Button, ButtonRow, Dialog, FactList, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * The finance approver's decision on what an officer prepared: Your reason, Approve and Decline, for a write-off on
 * SCR-FIN-15 and a refund on SCR-FIN-10. Approve asks first, naming the amount and what is recorded with it, because
 * the money it moves cannot be called back by the page; Decline is sent at once, and the server refuses it without a
 * reason. The page draws what was recorded.
 */
export function ApproverDecision({
  action,
  subject,
  copy,
  facts,
  initialReason,
  reasonError,
  approveUnavailable,
  locale,
}: {
  action: (form: FormData) => Promise<void>;
  /** The record the decision is on, as the form field the action reads it from: an amount owed, a correction. */
  subject: { name: "amount" | "correction"; value: string };
  copy: {
    reason: string;
    reasonHelp: string;
    approve: string;
    decline: string;
    dialogTitle: string;
    dialogText: string;
    dialogYes: string;
    dialogNo: string;
  };
  /** The facts the confirmation repeats: what the proposal rests on. */
  facts: { label: string; value: string }[];
  initialReason: string;
  /** A decline sent without a reason: the field's error, with no code. */
  reasonError: string | null;
  /** Why Approve is unavailable (a proposal that names no authority), or null when it is offered. */
  approveUnavailable: string | null;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const decision = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState(initialReason);
  const [confirming, setConfirming] = useState(false);
  const [sending, startSending] = useTransition();

  function send(value: "approve" | "decline") {
    if (decision.current !== null) decision.current.value = value;
    startSending(() => form.current?.requestSubmit());
  }

  return (
    <form ref={form} action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <input type="hidden" name={subject.name} value={subject.value} />
      <input ref={decision} type="hidden" name="decision" defaultValue="decline" />
      <TextField
        label={copy.reason}
        helper={copy.reasonHelp}
        name="reason"
        value={reason}
        onChange={(value: string) => setReason(value)}
        multiline
        rows={3}
        maxLength={2000}
        {...(reasonError !== null && reason === initialReason ? { error: reasonError } : {})}
        density="console"
        locale={locale}
      />
      <ButtonRow>
        <Button
          variant="primary"
          size="sm"
          {...(approveUnavailable !== null ? { disabled: true, disabledReason: approveUnavailable } : {})}
          loading={sending && confirming}
          onClick={() => setConfirming(true)}
          locale={locale}
        >
          {copy.approve}
        </Button>
        <Button variant="secondary" size="sm" loading={sending && !confirming} onClick={() => send("decline")} locale={locale}>
          {copy.decline}
        </Button>
      </ButtonRow>
      {confirming ? (
        <Dialog
          title={copy.dialogTitle}
          description={copy.dialogText}
          primaryAction={{ label: copy.dialogYes, variant: "primary", loading: sending, onClick: () => send("approve") }}
          secondaryAction={{ label: copy.dialogNo, onClick: () => setConfirming(false) }}
          onClose={() => setConfirming(false)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          <FactList items={reason.trim() === "" ? facts : [...facts, { label: copy.reason, value: reason }]} density="console" locale={locale} />
        </Dialog>
      ) : null}
    </form>
  );
}

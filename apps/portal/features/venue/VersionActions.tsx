"use client";

import { useState, useTransition } from "react";
import { Button, ButtonRow, Dialog, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { SubmitButton } from "./SubmitButton";

/**
 * SCR-VEN-18's action row: Approve, which does not ask (design/03), and Withdraw with a reason, which asks with the
 * reason in the confirmation. A control the reader's role does not hold, or the version's state forbids, stays on the
 * row unavailable with its reason. FIELD_MISSING brings the confirmation back with the reason marked.
 */
export function VersionActions({
  approve,
  withdraw,
  back,
  dialog,
  locale,
}: {
  approve: { label: string; reason: string | null; action: () => Promise<void> };
  withdraw: { label: string; reason: string | null; action: (formData: FormData) => Promise<void> };
  back: { label: string; href: string };
  dialog: { title: string; text: string; reason: string; yes: string; no: string; open: boolean; reasonError: string | null; initialReason: string };
  locale: Locale;
}) {
  const [open, setOpen] = useState(dialog.open);
  const [reason, setReason] = useState(dialog.initialReason);
  const [sending, startSending] = useTransition();
  return (
    <>
      <form action={approve.action} style={{ display: "contents" }}>
        <ButtonRow>
          <SubmitButton variant="primary" size="sm" disabled={approve.reason !== null} {...(approve.reason !== null ? { disabledReason: approve.reason } : {})} locale={locale}>
            {approve.label}
          </SubmitButton>
          <Button
            variant="secondary"
            size="sm"
            disabled={withdraw.reason !== null}
            {...(withdraw.reason !== null ? { disabledReason: withdraw.reason } : {})}
            onClick={() => setOpen(true)}
            locale={locale}
          >
            {withdraw.label}
          </Button>
          <Button variant="quiet" size="sm" href={back.href} locale={locale}>
            {back.label}
          </Button>
        </ButtonRow>
      </form>
      {open ? (
        <Dialog
          title={dialog.title}
          description={dialog.text}
          primaryAction={{
            label: dialog.yes,
            variant: "danger",
            loading: sending,
            onClick: () => {
              const form = new FormData();
              form.set("reason", reason);
              startSending(() => withdraw.action(form));
            },
          }}
          secondaryAction={{ label: dialog.no, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="overlay"
          align="start"
          autoFocus={false}
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          <TextField
            label={dialog.reason}
            name="reason"
            value={reason}
            onChange={setReason}
            {...(dialog.reasonError !== null ? { error: dialog.reasonError } : {})}
            required
            multiline
            rows={2}
            density="console"
            locale={locale}
          />
        </Dialog>
      ) : null}
    </>
  );
}

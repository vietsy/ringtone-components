"use client";

import { useState } from "react";
import { Button, Dialog, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { useMissingFields } from "./RequiredForm";

type Variant = "primary" | "secondary" | "quiet" | "danger";

/**
 * A console act that is confirmed first (convention 9): the button opens a dialog whose sentence names the
 * consequence, and its primary action sends the form the button belongs to, by the form's id. Where the act needs
 * one more answer - the reason a request is cancelled - the dialog asks for it and writes it into the form's field
 * of that name before sending. The way out closes the dialog and changes nothing.
 */
export function ConfirmSubmit({
  formId,
  label,
  variant = "primary",
  disabledReason = null,
  reasons = [],
  intent,
  field,
  dialog,
  locale,
}: {
  formId: string;
  label: string;
  variant?: Variant;
  /** While set, the act cannot be taken and the sentence says why beside it (convention 3). */
  disabledReason?: string | null;
  /** Inside a RequiredForm: the sentence for each required field, the first still empty said beside the button. */
  reasons?: readonly { field: string; text: string }[];
  /** The value the form's `intent` field takes before it is sent, where one form carries two acts. */
  intent?: string;
  /** One more answer the dialog asks for, sent in the form's field of that name. */
  field?: { name: string; label: string; helper?: string; missing: string };
  dialog: { title: string; description: string; confirm: string; confirmVariant?: Variant; back: string };
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [answer, setAnswer] = useState("");
  const missing = useMissingFields();
  const why = disabledReason ?? reasons.find((entry) => missing.includes(entry.field))?.text ?? null;

  function send() {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const intentField = form.elements.namedItem("intent");
    if (intent !== undefined && intentField instanceof HTMLInputElement) intentField.value = intent;
    const answerField = field !== undefined ? form.elements.namedItem(field.name) : null;
    if (answerField instanceof HTMLInputElement) answerField.value = answer;
    setSending(true);
    form.requestSubmit();
  }

  const unanswered = field !== undefined && answer.trim() === "";
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        {...(why !== null ? { disabled: true, disabledReason: why } : {})}
        onClick={() => setOpen(true)}
        locale={locale}
      >
        {label}
      </Button>
      {open ? (
        <Dialog
          title={dialog.title}
          description={dialog.description}
          primaryAction={{
            label: dialog.confirm,
            variant: dialog.confirmVariant ?? "primary",
            loading: sending,
            onClick: send,
            ...(unanswered && field !== undefined ? { disabled: true, disabledReason: field.missing } : {}),
          }}
          secondaryAction={{ label: dialog.back, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          {field !== undefined ? (
            <TextField
              label={field.label}
              {...(field.helper !== undefined ? { helper: field.helper } : {})}
              value={answer}
              onChange={setAnswer}
              multiline
              rows={3}
              required
              density="console"
              locale={locale}
            />
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}

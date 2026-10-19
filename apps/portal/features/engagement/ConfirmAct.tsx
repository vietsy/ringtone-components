"use client";

import { R1_FORMAT } from "@rightone/formatting";
import { useState } from "react";
import { Button, Dialog } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Variant = "primary" | "secondary" | "quiet" | "danger";

/**
 * One of the four acts this family confirms (design/03 convention 9: authorising a correction, approving an award rule
 * version, releasing the capability, suspending it, and withdrawing a release with them): the button opens a dialog
 * whose sentence names the consequence, never *are you sure*, and its primary action sends the page's form by its id,
 * with `intent` set where one form carries several acts. `fill` puts the instant the reader typed into the sentence
 * (the effective instant), written as the portal writes a moment, so they confirm what they entered. Disabled, the
 * reason stands beside the button.
 */
export function ConfirmAct({
  formId,
  label,
  variant = "primary",
  intent,
  disabledReason,
  dialog,
  fill,
  locale,
}: {
  formId: string;
  label: string;
  variant?: Variant;
  intent?: string;
  disabledReason?: string | null;
  dialog: { title: string; description: string; confirm: string; back: string };
  /** The date-and-time field whose instant replaces `token` in the sentence, and the words while it is empty. */
  fill?: { field: string; token: string; empty: string };
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [description, setDescription] = useState(dialog.description);
  const off = disabledReason !== undefined && disabledReason !== null;

  function form(): HTMLFormElement | null {
    const element = document.getElementById(formId);
    return element instanceof HTMLFormElement ? element : null;
  }

  function ask() {
    if (fill !== undefined) {
      const field = form()?.elements.namedItem(fill.field);
      const value = field instanceof HTMLInputElement ? field.value.trim() : "";
      const instant = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\+07:00$/.exec(value)?.[1];
      const words = instant !== undefined ? R1_FORMAT.formatTimestamp(`${instant}:00+07:00`, locale) : null;
      setDescription(dialog.description.replace(fill.token, words ?? fill.empty));
    }
    setOpen(true);
  }

  function send() {
    const target = form();
    if (target === null) return;
    const field = target.elements.namedItem("intent");
    if (intent !== undefined && field instanceof HTMLInputElement) field.value = intent;
    setSending(true);
    target.requestSubmit();
  }

  return (
    <>
      <Button variant={variant} size="sm" {...(off ? { disabled: true, disabledReason } : {})} onClick={ask} locale={locale}>
        {label}
      </Button>
      {open ? (
        <Dialog
          title={dialog.title}
          description={description}
          primaryAction={{ label: dialog.confirm, variant, loading: sending, onClick: send }}
          secondaryAction={{ label: dialog.back, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-lg)"
          locale={locale}
        />
      ) : null}
    </>
  );
}

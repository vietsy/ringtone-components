"use client";

import { useState, type ReactNode } from "react";
import { Button, Dialog } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Variant = "primary" | "secondary" | "quiet" | "danger";

/**
 * A console act confirmed first, where the spec asks for a confirmation (Send for approval, Approve, Withdraw,
 * Record the service, Issue the outstanding notices): the button opens a dialog naming the object and what follows,
 * and its primary action sends the page's form by its id, with `intent` set where one form carries two acts. The
 * way out closes the dialog and sends nothing. `fill` puts what the reader typed into the dialog's sentence (the
 * date of service), so they confirm what they entered.
 */
export function ConfirmAct({
  formId,
  label,
  variant = "primary",
  intent,
  disabledReason,
  dialog,
  fill,
  children,
  locale,
}: {
  formId: string;
  label: string;
  variant?: Variant;
  intent?: string;
  /** While set, the act is refused here, and the sentence says why beside it. */
  disabledReason?: string | null;
  dialog: { title: string; description: string; confirm: string; confirmVariant?: Variant; back: string };
  fill?: { field: string; token: string };
  children?: ReactNode;
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
    const field = fill !== undefined ? form()?.elements.namedItem(fill.field) : null;
    const typed = field instanceof HTMLInputElement ? field.value.trim() : "";
    setDescription(fill !== undefined ? dialog.description.replace(fill.token, typed !== "" ? typed : "…") : dialog.description);
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
          primaryAction={{ label: dialog.confirm, variant: dialog.confirmVariant ?? variant, loading: sending, onClick: send }}
          secondaryAction={{ label: dialog.back, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-lg)"
          locale={locale}
        >
          {children}
        </Dialog>
      ) : null}
    </>
  );
}

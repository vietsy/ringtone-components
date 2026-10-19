"use client";

import { useState, type ReactNode } from "react";
import { Button, Dialog } from "@/components/r1";
import { useHydrated } from "./ShortcutButton";
import type { Locale } from "@/lib/i18n/translate";

type Variant = "primary" | "secondary" | "quiet" | "danger";

/**
 * A console act that is confirmed first (convention 12): the button opens a dialog that names the object and the
 * consequence, and its primary action sends the form the button belongs to, by the form's id. The way out closes
 * the dialog and changes nothing; Esc does the same and focus returns to the button.
 */
export function ConfirmSubmit({
  formId,
  label,
  variant = "primary",
  shortcut,
  disabledReason,
  intent,
  dialog,
  children,
  locale,
}: {
  formId: string;
  label: string;
  variant?: Variant;
  shortcut?: string;
  /**
   * While set, the act cannot be taken and the sentence says why beside it (convention 14). Empty: held for the
   * reason the button before it in the row already gives, which the row says once.
   */
  disabledReason?: string | null;
  /** The value the form's `intent` field takes before it is sent, where one form carries two acts. */
  intent?: string;
  dialog: { title: string; description: string; confirm: string; confirmVariant?: Variant; back: string };
  children?: ReactNode;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const hydrated = useHydrated();
  const off = disabledReason !== undefined && disabledReason !== null;

  function send() {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const field = form.elements.namedItem("intent");
    if (intent !== undefined && field instanceof HTMLInputElement) field.value = intent;
    setSending(true);
    form.requestSubmit();
  }

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        {...(shortcut !== undefined && hydrated ? { shortcut } : {})}
        {...(off ? { disabled: true, ...(disabledReason !== "" ? { disabledReason } : {}) } : {})}
        onClick={() => setOpen(true)}
        locale={locale}
      >
        {label}
      </Button>
      {open ? (
        <Dialog
          title={dialog.title}
          description={dialog.description}
          primaryAction={{ label: dialog.confirm, variant: dialog.confirmVariant ?? "primary", loading: sending, onClick: send }}
          secondaryAction={{ label: dialog.back, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          {children}
        </Dialog>
      ) : null}
    </>
  );
}

"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button, Dialog, FactList } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Variant = "primary" | "secondary" | "quiet" | "danger";

const noSubscription = () => () => undefined;

/**
 * An act confirmed first: the button opens a dialog that names the object and the consequence, and its primary
 * action sends the form the button belongs to, by the form's id, with the form's `intent` set where one form carries
 * two acts. The way out closes the dialog and changes nothing; Esc does the same. `typed` repeats in the dialog what
 * the person wrote in the form's fields (a ground, what was done), read when the dialog opens. A shortcut is bound
 * once the page has hydrated, as R1 draws it the platform's way.
 */
export function ConfirmSubmit({
  formId,
  label,
  variant = "primary",
  size = "sm",
  icon,
  fullWidth = false,
  disabledReason = null,
  intent,
  dialog,
  typed = [],
  shortcut,
  density,
  children,
  locale,
}: {
  formId: string;
  label: string;
  variant?: Variant;
  size?: "sm" | "md";
  icon?: string;
  fullWidth?: boolean;
  /** While set, the act cannot be taken and the sentence says why beside it. */
  disabledReason?: string | null;
  intent?: string;
  dialog: { title: string; description: string; confirm: string; confirmVariant?: Variant; back: string };
  /** Fields of the form whose values the dialog repeats, with the words for an empty one. */
  typed?: readonly { name: string; label: string; none: string }[];
  shortcut?: string;
  density: "console" | "portal";
  children?: ReactNode;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [values, setValues] = useState<readonly { label: string; value: string }[]>([]);
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  function show() {
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement && typed.length > 0) {
      const data = new FormData(form);
      setValues(
        typed.map((field) => {
          const raw = data.get(field.name);
          return { label: field.label, value: (typeof raw === "string" ? raw.trim() : "") || field.none };
        }),
      );
    }
    setOpen(true);
  }

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
        size={size}
        {...(icon !== undefined ? { icon } : {})}
        {...(fullWidth ? { fullWidth: true } : {})}
        {...(disabledReason !== null ? { disabled: true, disabledReason } : {})}
        {...(shortcut !== undefined && hydrated ? { shortcut } : {})}
        onClick={show}
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
          density={density}
          width={density === "portal" && fullWidth ? "100%" : "var(--container-xl)"}
          locale={locale}
        >
          {children}
          {values.length > 0 ? <FactList items={values.map((entry) => ({ label: entry.label, value: entry.value }))} density={density === "console" ? "console" : "portal"} locale={locale} /> : null}
        </Dialog>
      ) : null}
    </>
  );
}

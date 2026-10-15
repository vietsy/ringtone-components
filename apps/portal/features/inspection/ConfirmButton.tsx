"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, Dialog } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Variant = "primary" | "secondary" | "quiet" | "danger";

interface Props {
  trigger: {
    label: string;
    variant: Variant;
    size: "md" | "lg";
    icon?: string;
    disabledReason?: string;
  };
  dialog: {
    title: string;
    description: string;
    primary: { label: string; variant: Variant };
    secondaryLabel: string;
  };
  /** False sends straight away: the board asks only when there is something to lose. */
  confirm?: boolean;
  /** Open on arrival: the demo's view of the dialog itself. */
  defaultOpen?: boolean;
  /** The server action the confirmation sends, with the fields in the dialog. */
  action?: (form: FormData) => Promise<void>;
  /** Send this form of the page instead: the dialog confirms what the page's form holds. */
  formId?: string;
  /** The dialog's body: the facts it names, or the field it asks for. */
  children?: ReactNode;
  locale: Locale;
}

/**
 * A control whose act is confirmed in a dialog first: Sign out with results waiting (SCR-VER-17), Abandon
 * (SCR-VER-04), Issue the record (SCR-VER-05). Focus opens on the dialog's title and Huỷ closes it; the primary
 * action sends the dialog's own form or the page's.
 */
export function ConfirmButton({ trigger, dialog, confirm = true, defaultOpen = false, action, formId, children, locale }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const own = useRef<HTMLFormElement>(null);

  function send() {
    const form = formId !== undefined ? document.getElementById(formId) : own.current;
    if (form instanceof HTMLFormElement) form.requestSubmit();
  }

  const body = (
    <Dialog
      title={dialog.title}
      description={dialog.description}
      primaryAction={{ label: dialog.primary.label, variant: dialog.primary.variant, onClick: send }}
      secondaryAction={{ label: dialog.secondaryLabel, onClick: () => setOpen(false) }}
      onClose={() => setOpen(false)}
      open={open}
      placement="overlay"
      align="start"
      density="portal"
      locale={locale}
    >
      {children}
    </Dialog>
  );

  return (
    <>
      <Button
        variant={trigger.variant}
        size={trigger.size}
        {...(trigger.icon !== undefined ? { icon: trigger.icon } : {})}
        fullWidth
        {...(trigger.disabledReason !== undefined ? { disabled: true, disabledReason: trigger.disabledReason } : {})}
        onClick={() => (confirm ? setOpen(true) : send())}
        locale={locale}
      >
        {trigger.label}
      </Button>
      {formId === undefined && action !== undefined ? (
        // display: contents keeps the form out of a ButtonRow's layout; it only carries the dialog's fields.
        <form ref={own} action={action} style={{ display: "contents" }}>
          {open && body}
        </form>
      ) : (
        open && body
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Dialog, FactList } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * Send the return on SCR-FIN-10: the button opens its confirmation, which repeats the amount, where it goes and who
 * approved it, and says that a sent return cannot be called back; its primary action sends the form. The list's row
 * action Send opens the page with the confirmation open, as the board draws it: it opens once the page has hydrated,
 * since the dialog is drawn in a layer the server does not render. The way out closes it and sends nothing.
 */
export function ConfirmSend({
  action,
  correction,
  initiallyOpen,
  copy,
  facts,
  locale,
}: {
  action: (form: FormData) => Promise<void>;
  /** The correction whose refund is sent. */
  correction: string;
  initiallyOpen: boolean;
  copy: { button: string; title: string; text: string; yes: string; no: string };
  facts: { label: string; value: string; kind?: "id" | "money" | "datetime" }[];
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [sending, startSending] = useTransition();
  useEffect(() => {
    if (initiallyOpen) setOpen(true);
  }, [initiallyOpen]);

  return (
    <form ref={form} action={action}>
      <input type="hidden" name="correction" value={correction} />
      <Button variant="primary" size="sm" loading={sending} onClick={() => setOpen(true)} locale={locale}>
        {copy.button}
      </Button>
      {open ? (
        <Dialog
          title={copy.title}
          description={copy.text}
          primaryAction={{ label: copy.yes, variant: "primary", loading: sending, onClick: () => startSending(() => form.current?.requestSubmit()) }}
          secondaryAction={{ label: copy.no, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          <FactList items={facts} density="console" locale={locale} />
        </Dialog>
      ) : null}
    </form>
  );
}

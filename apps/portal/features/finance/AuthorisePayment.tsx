"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Dialog, FactList } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { authorisePayment } from "./actions";

type Facts = Parameters<typeof FactList>[0]["items"];

/**
 * Authorise payment and its one confirmation (SCR-FIN-01, FR-FIN-037). The dialog names the decision and
 * the payer and repeats the three components; confirming records the authorisation on the server, which
 * opens the instruction. The words come from the page, already in the reader's language.
 */
export function AuthorisePayment({
  decision,
  label,
  fullWidth,
  initiallyOpen,
  dialog,
  locale,
}: {
  decision: string;
  label: string;
  fullWidth: boolean;
  /** The authorise-confirm review state draws the dialog open. */
  initiallyOpen: boolean;
  dialog: { title: string; description: string; cancel: string; facts: Facts; width: string };
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // The dialog portals into the page body, which exists only in the browser. Opened during the server
  // render it would be drawn inline there and in a portal here, and hydration would fail; so a dialog the
  // view draws open opens once the page has mounted.
  useEffect(() => {
    if (initiallyOpen) setOpen(true);
  }, [initiallyOpen]);

  return (
    <>
      <Button variant="primary" size="md" fullWidth={fullWidth} onClick={() => setOpen(true)} locale={locale}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={dialog.title}
        description={dialog.description}
        primaryAction={{
          label,
          variant: "primary",
          loading: pending,
          onClick: () => startTransition(() => authorisePayment(decision)),
        }}
        secondaryAction={{ label: dialog.cancel, onClick: () => setOpen(false) }}
        placement="viewport"
        align="start"
        density="portal"
        width={dialog.width}
        locale={locale}
      >
        <FactList items={dialog.facts} density="portal" locale={locale} />
      </Dialog>
    </>
  );
}

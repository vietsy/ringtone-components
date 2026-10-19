"use client";

import { useState } from "react";
import { Button, Dialog, FactList } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Fact = { label: string; value: unknown; kind?: "date" | "count" };

/**
 * "Phê duyệt phiên bản" on SCR-DAT-16, confirmed as convention 9 asks for a version with an effective date: the button
 * opens a dialog naming the consequence and the version's terms, and its primary action sends the approval form by its
 * id, which carries the version as it was previewed. The way out closes the dialog and sends nothing. While the
 * version cannot be approved the button is off with the reason beside it.
 */
export function ConfirmApproval({
  formId,
  label,
  disabledReason,
  dialog,
  facts,
  locale,
}: {
  formId: string;
  label: string;
  disabledReason: string | null;
  dialog: { title: string; description: string; confirm: string; back: string };
  facts: readonly Fact[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  function send() {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    setSending(true);
    form.requestSubmit();
  }

  return (
    <>
      <Button variant="primary" size="sm" {...(disabledReason !== null ? { disabled: true, disabledReason } : {})} onClick={() => setOpen(true)} locale={locale}>
        {label}
      </Button>
      {open ? (
        <Dialog
          title={dialog.title}
          description={dialog.description}
          primaryAction={{ label: dialog.confirm, loading: sending, onClick: send }}
          secondaryAction={{ label: dialog.back, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          <FactList items={[...facts]} density="console" locale={locale} />
        </Dialog>
      ) : null}
    </>
  );
}

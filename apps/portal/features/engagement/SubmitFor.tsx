"use client";

import { useState } from "react";
import { Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * A button that sends a form drawn elsewhere on the page, by its id: SCR-ENG-07's Submit for approval stands at the
 * foot of the editor, as the wireframe draws it, while the fields it sends sit above the action list (a form cannot
 * hold the action list's own forms). Not confirmed; disabled, its condition stands beside it.
 */
export function SubmitFor({ formId, label, disabledReason, locale }: { formId: string; label: string; disabledReason: string | null; locale: Locale }) {
  const [sending, setSending] = useState(false);
  function send() {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    setSending(true);
    form.requestSubmit();
  }
  return (
    <Button variant="primary" size="sm" loading={sending} {...(disabledReason !== null ? { disabled: true, disabledReason } : {})} onClick={send} locale={locale}>
      {label}
    </Button>
  );
}

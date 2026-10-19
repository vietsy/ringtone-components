"use client";

import { Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * One of the acts a single form carries (SCR-PUB-15's Lưu and Gửi duyệt): sets the form's `intent` and sends it, so
 * both acts send everything typed on the form.
 */
export function SubmitAs({
  formId,
  intent,
  label,
  variant = "secondary",
  icon,
  disabledReason,
  locale,
}: {
  formId: string;
  intent: string;
  label: string;
  variant?: "primary" | "secondary" | "quiet";
  icon?: string;
  disabledReason?: string | null;
  locale: Locale;
}) {
  const off = disabledReason !== undefined && disabledReason !== null;
  function send() {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const field = form.elements.namedItem("intent");
    if (field instanceof HTMLInputElement) field.value = intent;
    form.requestSubmit();
  }
  return (
    <Button
      variant={variant}
      size="sm"
      {...(icon !== undefined ? { icon } : {})}
      {...(off ? { disabled: true, disabledReason } : {})}
      onClick={send}
      locale={locale}
    >
      {label}
    </Button>
  );
}

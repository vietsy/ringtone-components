"use client";

import { useRef } from "react";
import { Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

interface Intent {
  /** What the action reads from the form's `intent` field when this button sends it. */
  intent: string;
  label: string;
  variant: "primary" | "secondary";
  size: "md" | "lg";
  icon?: string;
  /** The button cannot be used, for this reason. */
  disabledReason?: string;
}

/**
 * Several buttons that send one form, each saying which act it is: SCR-VER-03's Start, Start without the
 * answer and Continue the open inspection. The form's own fields are checked as on any submit, then the
 * action reads `intent`.
 */
export function IntentButtons({ buttons, locale }: { buttons: readonly Intent[]; locale: Locale }) {
  const intent = useRef<HTMLInputElement>(null);

  function send(value: string) {
    const field = intent.current;
    if (field === null) return;
    field.value = value;
    field.form?.requestSubmit();
  }

  return (
    <>
      <input type="hidden" name="intent" ref={intent} defaultValue="" />
      {buttons.map((button) => (
        <Button
          key={button.intent}
          variant={button.variant}
          size={button.size}
          {...(button.icon !== undefined ? { icon: button.icon } : {})}
          fullWidth
          {...(button.disabledReason !== undefined ? { disabled: true, disabledReason: button.disabledReason } : {})}
          onClick={() => send(button.intent)}
          locale={locale}
        >
          {button.label}
        </Button>
      ))}
    </>
  );
}

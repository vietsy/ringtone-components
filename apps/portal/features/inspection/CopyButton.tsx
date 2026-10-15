"use client";

import type { Locale } from "@/lib/i18n/translate";
import { ShortcutButton } from "./ShortcutButton";

interface Props {
  label: string;
  /** The reference to copy; null while no entry is selected, and the button says why it waits. */
  value: string | null;
  waitingReason: string;
  locale: Locale;
}

/** SCR-VER-08 Copy the premises reference of the entry in focus, also with Alt+C once the page has hydrated. */
export function CopyButton({ label, value, waitingReason, locale }: Props) {
  return (
    <ShortcutButton
      variant="primary"
      size="sm"
      icon="copy"
      shortcut="Alt+C"
      {...(value === null ? { disabled: true, disabledReason: waitingReason } : {})}
      onClick={() => {
        if (value !== null) void navigator.clipboard.writeText(value);
      }}
      locale={locale}
    >
      {label}
    </ShortcutButton>
  );
}

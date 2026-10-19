"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** SCR-COM-12's Save: the form's submit, working while its server action runs, and unavailable with its reason. */
export function SaveButton({
  disabledReason,
  loadingLabel,
  fullWidth,
  locale,
  children,
}: {
  disabledReason: string | null;
  loadingLabel: string;
  fullWidth: boolean;
  locale: Locale;
  children: ReactNode;
}) {
  const status = useFormStatus();
  return (
    <Button
      variant="primary"
      size="md"
      type="submit"
      loading={status.pending}
      loadingLabel={loadingLabel}
      disabled={disabledReason !== null}
      {...(disabledReason !== null ? { disabledReason } : {})}
      fullWidth={fullWidth}
      locale={locale}
    >
      {children}
    </Button>
  );
}

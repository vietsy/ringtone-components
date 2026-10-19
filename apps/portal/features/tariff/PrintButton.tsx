"use client";

import { Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** Print this page (SCR-TAR-14): the browser prints every step, with the reference and the date. */
export function PrintButton({ label, fullWidth, locale }: { label: string; fullWidth: boolean; locale: Locale }) {
  return (
    <Button variant="secondary" size="md" icon="printer" fullWidth={fullWidth} onClick={() => window.print()} locale={locale}>
      {label}
    </Button>
  );
}

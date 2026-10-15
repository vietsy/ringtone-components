"use client";

import { Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** SCR-VER-06 Print a copy: the browser's print of the record as it is shown. */
export function PrintButton({ label, variant, locale }: { label: string; variant: "primary" | "secondary"; locale: Locale }) {
  return (
    <Button variant={variant} size="md" icon="printer" fullWidth onClick={() => window.print()} locale={locale}>
      {label}
    </Button>
  );
}

"use client";

import { Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** The browser's print of the document as it is shown: to paper, or saved as a PDF from the print dialog. */
export function PrintButton({ label, locale }: { label: string; locale: Locale }) {
  return (
    <Button variant="primary" size="md" icon="printer" onClick={() => window.print()} locale={locale}>
      {label}
    </Button>
  );
}

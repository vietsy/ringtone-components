"use client";

import { useState, useTransition } from "react";
import { Button, Dialog } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * SCR-CAT-05's Acknowledge all, and the dialog that names the count before the outcomes are acknowledged (the
 * spec's confirmation). Acknowledging is recorded once and cannot be taken back.
 *
 * The dialog the person opens covers the window. The one the canvas draws open on arrival (the confirm view)
 * stays in the page as the board places it: a dialog portalled to the window exists only in the browser, so the
 * server's page and the browser's would differ on first render.
 */
export function AcknowledgeControl({
  copy,
  action,
  initiallyOpen,
  phone,
  locale,
}: {
  copy: { acknowledge: string; title: string; text: string; confirm: string; back: string };
  action: () => Promise<void>;
  initiallyOpen: boolean;
  phone: boolean;
  locale: Locale;
}) {
  const [open, setOpen] = useState<"on-arrival" | "by-person" | null>(initiallyOpen ? "on-arrival" : null);
  const [acknowledging, startAcknowledging] = useTransition();
  return (
    <>
      <Button variant="primary" size="md" onClick={() => setOpen("by-person")} locale={locale}>
        {copy.acknowledge}
      </Button>
      {open !== null ? (
        <Dialog
          title={copy.title}
          description={copy.text}
          primaryAction={{ label: copy.confirm, loading: acknowledging, onClick: () => startAcknowledging(action) }}
          secondaryAction={{ label: copy.back, onClick: () => setOpen(null) }}
          onClose={() => setOpen(null)}
          open
          placement={open === "on-arrival" ? "overlay" : "viewport"}
          align="start"
          autoFocus={open === "by-person"}
          density="portal"
          width={phone ? "100%" : "var(--container-xl)"}
          locale={locale}
        />
      ) : null}
    </>
  );
}

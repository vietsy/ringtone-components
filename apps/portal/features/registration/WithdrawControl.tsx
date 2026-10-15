"use client";

import { useState, useTransition } from "react";
import { Button, Dialog } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * SCR-REG-07's Withdraw this application, and the dialog that names the application before it is withdrawn.
 * Withdrawing cannot be undone, so it is the dialog's danger action.
 *
 * The dialog the person opens covers the window. The one the canvas draws open on arrival (the
 * withdraw-confirm view) stays in the page, as the board places it: a dialog portalled to the window exists
 * only in the browser, so the server's page and the browser's would differ on first render.
 */
export function WithdrawControl({
  copy,
  action,
  initiallyOpen,
  phone,
  locale,
}: {
  copy: { withdraw: string; title: string; text: string; confirm: string; keep: string };
  action: () => Promise<void>;
  /** The canvas's withdraw-confirm view: the dialog drawn open. */
  initiallyOpen: boolean;
  phone: boolean;
  locale: Locale;
}) {
  const [open, setOpen] = useState<"on-arrival" | "by-person" | null>(initiallyOpen ? "on-arrival" : null);
  const [withdrawing, startWithdrawing] = useTransition();
  return (
    <>
      <Button variant="secondary" size="md" fullWidth={phone} onClick={() => setOpen("by-person")} locale={locale}>
        {copy.withdraw}
      </Button>
      {open !== null ? (
        <Dialog
          title={copy.title}
          description={copy.text}
          primaryAction={{
            label: copy.confirm,
            variant: "danger",
            loading: withdrawing,
            onClick: () => startWithdrawing(action),
          }}
          secondaryAction={{ label: copy.keep, onClick: () => setOpen(null) }}
          onClose={() => setOpen(null)}
          open
          placement={open === "on-arrival" ? "overlay" : "viewport"}
          // The page is taller than a window, so the dialog drawn over it sits near its top, where it is read.
          align="start"
          density="portal"
          width={phone ? "100%" : "var(--container-xl)"}
          locale={locale}
        />
      ) : null}
    </>
  );
}

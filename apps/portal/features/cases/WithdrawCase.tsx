"use client";

import { useState, useTransition } from "react";
import { Button, Dialog } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * SCR-CAS-02's Withdraw this case, and the dialog that names the consequence before the case is withdrawn
 * (convention 9): withdrawing cannot be undone, so it is the dialog's danger action.
 */
export function WithdrawCase({
  copy,
  action,
  disabledReason,
  phone,
  locale,
}: {
  copy: { withdraw: string; title: string; text: string; confirm: string; keep: string };
  action: () => Promise<void>;
  /** The state the case is in, said beside the button when it can no longer be withdrawn. */
  disabledReason: string | null;
  phone: boolean;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [withdrawing, startWithdrawing] = useTransition();
  return (
    <>
      <Button
        variant="secondary"
        size="md"
        fullWidth={phone}
        disabled={disabledReason !== null}
        {...(disabledReason !== null ? { disabledReason } : {})}
        onClick={() => setOpen(true)}
        locale={locale}
      >
        {copy.withdraw}
      </Button>
      {open ? (
        <Dialog
          title={copy.title}
          description={copy.text}
          primaryAction={{ label: copy.confirm, variant: "danger", loading: withdrawing, onClick: () => startWithdrawing(action) }}
          secondaryAction={{ label: copy.keep, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          density="portal"
          width={phone ? "100%" : "var(--container-xl)"}
          locale={locale}
        />
      ) : null}
    </>
  );
}

"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { SidePanel } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * A console act made in a side panel beside the page, as the boards draw Create party, Add person and Record
 * principal: the panel is the form, its first action sends it, and closing it (Cancel, the close button, Esc) goes
 * back to the page without the panel. The fields are the page's; the form keeps no state of its own.
 */
export function PanelForm({
  action,
  title,
  eyebrow,
  submit,
  cancel,
  closeHref,
  disabledReason = null,
  children,
  locale,
}: {
  action: (formData: FormData) => Promise<void>;
  title: string;
  eyebrow: string;
  submit: string;
  cancel: string;
  /** The page without the panel. */
  closeHref: Route;
  disabledReason?: string | null;
  children: ReactNode;
  locale: Locale;
}) {
  const router = useRouter();
  const id = useId();
  const [sending, setSending] = useState(false);
  const close = () => router.push(closeHref);
  const send = () => {
    const form = document.getElementById(id);
    if (!(form instanceof HTMLFormElement)) return;
    setSending(true);
    form.requestSubmit();
  };
  return (
    <form id={id} action={action} noValidate>
      <SidePanel
        title={title}
        eyebrow={eyebrow}
        actions={[
          { label: submit, variant: "primary", ...(disabledReason !== null ? { disabled: true, disabledReason } : sending ? { disabled: true } : { onClick: send }) },
          { label: cancel, variant: "quiet", onClick: close },
        ]}
        onClose={close}
        open
        density="console"
        locale={locale}
      >
        {children}
      </SidePanel>
    </form>
  );
}

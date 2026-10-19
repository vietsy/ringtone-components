"use client";

import { useRef, useState } from "react";
import { Button, ButtonRow, Dialog, FactList } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Fact = { label: string; value: unknown; kind?: "mono" | "datetime" };

interface Props {
  /** The form the decision is sent with; its fields are read into the confirmation. */
  formId: string;
  approve: { label: string; icon?: string };
  decline: { label: string; variant: "secondary" };
  back: { label: string; href: string; variant: "quiet" | "secondary" };
  /** The confirmation of an approval, naming its object (design/03 convention 9). */
  dialog: {
    title: string;
    description: string;
    yes: { label: string; variant: "primary" | "danger" };
    cancel: string;
    /** What the confirmation restates from the page. */
    facts: readonly Fact[];
    /** The fields typed into the form, restated as the person typed them. */
    typed: readonly { name: string; label: string; none: string; many?: boolean }[];
  };
  label: string;
  locale: Locale;
}

/**
 * Approve and Decline of SCR-CER-03 and SCR-CER-06. Approve asks first, in a dialog that restates the act and what the
 * person typed; Decline sends at once, as the boards draw it. Both send the page's form with the decision named, so
 * the server checks the same fields either way.
 */
export function DecisionControls({ formId, approve, decline, back, dialog, label, locale }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState<Fact[]>([]);
  const decision = useRef<HTMLInputElement>(null);

  const form = () => {
    const element = document.getElementById(formId);
    return element instanceof HTMLFormElement ? element : null;
  };

  function send(value: "APPROVE" | "DECLINE") {
    if (decision.current !== null) decision.current.value = value;
    form()?.requestSubmit();
  }

  function confirm() {
    const element = form();
    const data = element !== null ? new FormData(element) : new FormData();
    setTyped(
      dialog.typed.map((field) => {
        const values = data
          .getAll(field.name)
          .filter((value): value is string => typeof value === "string" && value.trim() !== "")
          .map((value) => value.trim());
        return { label: field.label, value: values.length > 0 ? values.join(field.many === true ? "; " : " ") : field.none };
      }),
    );
    setOpen(true);
  }

  return (
    <>
      <input ref={decision} type="hidden" name="decision" defaultValue="APPROVE" />
      <ButtonRow label={label}>
        <Button variant="primary" size="sm" {...(approve.icon !== undefined ? { icon: approve.icon } : {})} onClick={confirm} locale={locale}>
          {approve.label}
        </Button>
        <Button variant={decline.variant} size="sm" onClick={() => send("DECLINE")} locale={locale}>
          {decline.label}
        </Button>
        <Button variant={back.variant} size="sm" href={back.href} locale={locale}>
          {back.label}
        </Button>
      </ButtonRow>
      <Dialog
        title={dialog.title}
        description={dialog.description}
        primaryAction={{ label: dialog.yes.label, variant: dialog.yes.variant, onClick: () => send("APPROVE") }}
        secondaryAction={{ label: dialog.cancel, onClick: () => setOpen(false) }}
        onClose={() => setOpen(false)}
        open={open}
        placement="overlay"
        align="start"
        density="console"
        width="var(--container-xl)"
        locale={locale}
      >
        <FactList items={[...dialog.facts, ...typed]} density="console" locale={locale} />
      </Dialog>
    </>
  );
}

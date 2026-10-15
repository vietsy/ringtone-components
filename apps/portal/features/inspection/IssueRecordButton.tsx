"use client";

import { useState } from "react";
import { R1_FORMAT } from "@rightone/formatting";
import { Button, Dialog, FactList } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Fact = { label: string; value: string };

interface Props {
  /** The page's conclusion form, which the confirmation sends. */
  formId: string;
  trigger: { label: string; disabledReason?: string };
  dialog: { title: string; description: string; issue: string; cancel: string };
  /** The facts' labels, and the words for each value the form can hold (design/03 section 5c). */
  words: {
    outcome: string;
    route: string;
    followUp: string;
    outcomes: Readonly<Record<string, string>>;
    routes: Readonly<Record<string, string>>;
    followUps: Readonly<Record<string, string>>;
    /** The dated follow-ups, with `{d}` for the date: "Sẽ kiểm tra lại trước ngày {d}". */
    dated: Readonly<Record<string, string>>;
  };
  /** What the dialog names when it is open on arrival: the review state of the dialog itself. */
  initialFacts: Fact[];
  defaultOpen: boolean;
  locale: Locale;
}

/** The dd/mm/yyyy a date field without a time sends, or an ISO date, as an ISO date; null for neither. */
function isoDay(value: string): string | null {
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (dmy?.[1] !== undefined && dmy[2] !== undefined && dmy[3] !== undefined) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * SCR-VER-05 Issue the record. The confirmation names what is about to be issued - the outcome, the route of a
 * referral, the follow-up with its date - as the form holds it at the moment the inspector asks, and Issue sends
 * that form (design/03 convention 8).
 */
export function IssueRecordButton({ formId, trigger, dialog, words, initialFacts, defaultOpen, locale }: Props) {
  const [facts, setFacts] = useState<Fact[] | null>(defaultOpen ? initialFacts : null);

  function form(): HTMLFormElement | null {
    const element = document.getElementById(formId);
    return element instanceof HTMLFormElement ? element : null;
  }

  function ask() {
    const target = form();
    if (target === null) return;
    // The browser asks for a required choice first, as it would on any submit.
    if (!target.reportValidity()) return;
    const data = new FormData(target);
    const read = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    const outcome = read("outcome");
    const followUp = read("follow_up_kind");
    const day = isoDay(read("follow_up_by"));
    const dated = words.dated[followUp];
    setFacts([
      { label: words.outcome, value: words.outcomes[outcome] ?? "" },
      ...(outcome === "REFERRED" ? [{ label: words.route, value: words.routes[read("referral_route")] ?? "" }] : []),
      {
        label: words.followUp,
        value:
          dated !== undefined && day !== null
            ? dated.replace("{d}", R1_FORMAT.formatDate(day, locale) ?? day)
            : (words.followUps[followUp] ?? ""),
      },
    ]);
  }

  return (
    <>
      <Button
        variant="primary"
        size="lg"
        icon="file-check"
        fullWidth
        {...(trigger.disabledReason !== undefined ? { disabled: true, disabledReason: trigger.disabledReason } : {})}
        onClick={ask}
        locale={locale}
      >
        {trigger.label}
      </Button>
      {facts !== null && (
        <Dialog
          title={dialog.title}
          description={dialog.description}
          primaryAction={{ label: dialog.issue, variant: "primary", onClick: () => form()?.requestSubmit() }}
          secondaryAction={{ label: dialog.cancel, onClick: () => setFacts(null) }}
          onClose={() => setFacts(null)}
          open
          placement="overlay"
          align="start"
          density="portal"
          locale={locale}
        >
          <FactList items={facts} locale={locale} />
        </Dialog>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Button, ButtonRow, DateField, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmAct } from "./ConfirmAct";

const FORM = "eng13-draft";

export interface DraftCopy {
  en: string;
  enHelp: string;
  vi: string;
  viHelp: string;
  decision: string;
  decisionHelp: string;
  effective: string;
  effectiveHelp: string;
  approve: string;
  cancel: string;
  missingVi: string;
  missingEn: string;
  missingDecision: string;
  dialogTitle: string;
  dialogText: string;
  dialogYes: string;
  dialogBack: string;
}

/**
 * SCR-ENG-13's draft block for the DPO: both texts, the reserving decision and the effective instant, which is never
 * defaulted. Approve names what is missing while it is disabled - *the Vietnamese text is missing*, not *incomplete* -
 * and confirms with what the version becomes. Cancel clears the draft; no version is created.
 */
export function DisclosureDraft({
  action,
  copy,
  initial,
  defaultDecision,
  effectiveError,
  locale,
}: {
  action: (form: FormData) => Promise<void>;
  copy: DraftCopy;
  initial: { textEn: string; textVi: string; reservingDecision: string; date: string; time: string };
  /** The decision a fresh draft names: the one reserving the treatment today. */
  defaultDecision: string;
  effectiveError: string | null;
  locale: Locale;
}) {
  const [generation, setGeneration] = useState(0);
  const [textEn, setTextEn] = useState(initial.textEn);
  const [textVi, setTextVi] = useState(initial.textVi);
  const [decision, setDecision] = useState(initial.reservingDecision);
  const fresh = generation === 0;
  const missing = textVi.trim() === "" ? copy.missingVi : textEn.trim() === "" ? copy.missingEn : decision.trim() === "" ? copy.missingDecision : null;

  function clear() {
    setTextEn("");
    setTextVi("");
    setDecision(defaultDecision);
    setGeneration((value) => value + 1);
  }

  return (
    <form id={FORM} action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div key={generation} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <TextField label={copy.en} helper={copy.enHelp} name="treatment_text_en" value={textEn} onChange={setTextEn} multiline rows={4} maxLength={2000} required density="console" locale={locale} />
        <TextField label={copy.vi} helper={copy.viHelp} name="treatment_text_vi" value={textVi} onChange={setTextVi} multiline rows={4} maxLength={2000} required density="console" locale={locale} />
        <TextField label={copy.decision} helper={copy.decisionHelp} name="reserving_decision" value={decision} onChange={setDecision} mono required density="console" width="var(--space-48)" locale={locale} />
        <DateField
          label={copy.effective}
          helper={copy.effectiveHelp}
          name="effective_from"
          {...(fresh && initial.date !== "" ? { value: initial.date, time: initial.time } : {})}
          withTime
          required
          {...(fresh && effectiveError !== null ? { error: effectiveError } : {})}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
      </div>
      <ButtonRow>
        <ConfirmAct
          formId={FORM}
          label={copy.approve}
          disabledReason={missing}
          dialog={{ title: copy.dialogTitle, description: copy.dialogText, confirm: copy.dialogYes, back: copy.dialogBack }}
          locale={locale}
        />
        <Button variant="secondary" size="sm" onClick={clear} locale={locale}>
          {copy.cancel}
        </Button>
      </ButtonRow>
    </form>
  );
}

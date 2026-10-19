"use client";

import { useState } from "react";
import { ButtonRow, ChoiceList, Select, TextField } from "@/components/r1";
import type { ClassInput, RegisterClassView } from "@/lib/api/notices";
import type { Locale } from "@/lib/i18n/translate";
import { ActButton } from "./ActButton";

type Option = { value: string; label: string };

export interface ClassFormCopy {
  classLabel: string;
  classHelp: string;
  choose: string;
  event: string;
  recipient: string;
  channels: string;
  subjects: string;
  required: string;
  requiredHelp: string;
  proof: string;
  proofHelp: string;
  action: string;
  lead: string;
  leadHelp: string;
  add: string;
  yes: string;
  no: string;
}

/**
 * "Add a class" on SCR-COM-02. Choosing a class of the register fills in what the register says of it - the event
 * that raises it, the recipient, the channels, the subjects, and a lead time where its subject carries a date - and
 * the preparer may change them. Required, Proof of notice and what the notice states have no default and stay
 * unset until the preparer chooses, because an unstated designation must not read as a decision; the server refuses
 * the class with CLASS_DESIGNATION_MISSING beside whichever is unset.
 */
export function ClassForm({
  action,
  version,
  register,
  options,
  typed,
  errors,
  copy,
  locale,
}: {
  action: (form: FormData) => Promise<void>;
  version: number;
  register: readonly RegisterClassView[];
  options: { classes: readonly Option[]; events: readonly Option[]; roles: readonly Option[]; channels: readonly Option[]; subjects: readonly Option[]; actions: readonly Option[] };
  /** What was sent last time, where the server refused it. */
  typed: ClassInput | null;
  /** The refusal's sentence by field. */
  errors: Readonly<Record<string, string>>;
  copy: ClassFormCopy;
  locale: Locale;
}) {
  const [chosen, setChosen] = useState<ClassInput>(
    typed ?? { classCode: "", eventKind: "", recipientRole: "", channels: [], subjectKinds: [], isRequired: null, requiresProof: null, requiredActionRule: null, leadTimeDays: "" },
  );

  function pick(classCode: string) {
    const entry = register.find((candidate) => candidate.classCode === classCode);
    setChosen((before) => ({
      ...before,
      classCode,
      eventKind: entry?.eventKind ?? "",
      recipientRole: entry?.recipientRole ?? "",
      channels: entry?.channels ?? [],
      subjectKinds: entry?.subjectKinds ?? [],
      leadTimeDays: entry?.subjectDate === true ? "30" : "",
    }));
  }

  const yesNo = [
    { value: "yes", label: copy.yes },
    { value: "no", label: copy.no },
  ];
  const flag = (value: boolean | null) => (value === null ? {} : { value: value ? "yes" : "no" });
  const error = (field: string) => (errors[field] !== undefined ? { error: errors[field] } : {});

  return (
    <form action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <input type="hidden" name="version" value={version} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-64), 1fr))", gap: "var(--space-5)" }}>
        <Select
          label={copy.classLabel}
          helper={copy.classHelp}
          name="class"
          options={[{ value: "", label: copy.choose }, ...options.classes]}
          value={chosen.classCode}
          onChange={pick}
          required
          {...error("class")}
          density="console"
          locale={locale}
        />
        <Select label={copy.event} name="event" options={[...options.events]} value={chosen.eventKind} required density="console" locale={locale} />
        <Select label={copy.recipient} name="recipient" options={[...options.roles]} value={chosen.recipientRole} required {...error("recipient")} density="console" locale={locale} />
        <TextField
          label={copy.lead}
          helper={copy.leadHelp}
          name="lead"
          inputMode="numeric"
          value={chosen.leadTimeDays}
          {...error("lead")}
          density="console"
          locale={locale}
        />
      </div>
      <ChoiceList legend={copy.channels} name="channels" options={[...options.channels]} value={[...chosen.channels]} multiple layout="inline" required {...error("channels")} density="console" locale={locale} />
      <ChoiceList legend={copy.subjects} name="subjects" options={[...options.subjects]} value={[...chosen.subjectKinds]} multiple layout="inline" required {...error("subjects")} density="console" locale={locale} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-64), 1fr))", gap: "var(--space-5)" }}>
        <ChoiceList legend={copy.required} helper={copy.requiredHelp} name="required" options={yesNo} {...flag(chosen.isRequired)} layout="inline" required {...error("required")} density="console" locale={locale} />
        <ChoiceList legend={copy.proof} helper={copy.proofHelp} name="proof" options={yesNo} {...flag(chosen.requiresProof)} layout="inline" required {...error("proof")} density="console" locale={locale} />
        <ChoiceList
          legend={copy.action}
          name="action"
          options={[...options.actions]}
          {...(chosen.requiredActionRule !== null ? { value: chosen.requiredActionRule } : {})}
          layout="inline"
          required
          {...error("action")}
          density="console"
          locale={locale}
        />
      </div>
      <ButtonRow>
        <ActButton variant="secondary" size="sm" icon="plus" locale={locale}>
          {copy.add}
        </ActButton>
      </ButtonRow>
    </form>
  );
}

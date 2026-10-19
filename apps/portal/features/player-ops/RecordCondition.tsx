"use client";

import { useRef, useState } from "react";
import { Banner, ChoiceList, Combobox, DateField, Dialog, FactList, Select, TextField, format } from "@/components/r1";
import type { ConditionInput } from "@/lib/api/player";
import type { Locale } from "@/lib/i18n/translate";
import { recordCondition } from "./actions";
import { ShortcutButton } from "./ShortcutButton";

type Choice = { value: string; label: string };

export interface ConditionWords {
  record: string;
  formTitle: string;
  formDesc: string;
  /** The description when the condition is a transfer: the device leaves its premises at the transfer time. */
  formDescTransfer: string;
  condition: string;
  choose: string;
  cause: string;
  effective: string;
  effectiveHelp: string;
  /** A loss's or a compromise's time is when it is said to have happened; the help says so. */
  effectiveLost: string;
  effectiveHelpLost: string;
  reported: string;
  reportedHelp: string;
  reportedInvalid: string;
  newPremises: string;
  cross: string;
  pending: string;
  optSubmit: string;
  optDiscard: string;
  discardHint: string;
  ground: string;
  groundHelp: string;
  next: string;
  nextTransfer: string;
  keep: string;
  cfTitle: string;
  cfTitleTransfer: string;
  cfText: string;
  cfTextLost: string;
  cfTextTransfer: string;
  confirm: string;
  confirmTransfer: string;
  fDevice: string;
  fCondition: string;
  fCause: string;
  fFrom: string;
  fTo: string;
  fEffective: string;
  fPending: string;
  fPendingSubmit: string;
  fPendingDiscard: string;
  fGround: string;
  fReported: string;
  noTime: string;
  premisesMissing: string;
  conditionMissing: string;
}

/**
 * SCR-PLR-02's Record a condition: the form in a dialog, then the confirmation the board draws, which names what the
 * condition does before it is recorded. The cause is chosen from the list and the effective time is always given: a
 * loss or a compromise takes the time it is said to have happened, and when it was reported where that differs. A
 * transfer asks where the device goes and, while it still holds evidence, whether that goes to the premises where it
 * was played or is discarded. A refusal the form can answer reopens it with the refusal above the fields and what was
 * chosen kept.
 */
export function RecordCondition({
  device,
  premises,
  next,
  causes,
  transferTo,
  waiting,
  disabledReason,
  initial,
  refusal,
  field,
  words,
  locale,
}: {
  device: string;
  premises: string;
  next: readonly Choice[];
  causes: Readonly<Record<string, readonly Choice[]>>;
  transferTo: readonly (Choice & { detail: string | null })[];
  waiting: number;
  disabledReason: string | null;
  /** The values of a refused attempt, which reopen the form. */
  initial: ConditionInput | null;
  refusal: { code: string; title: string; text: string } | null;
  field: "condition" | "premises" | "reported" | null;
  words: ConditionWords;
  locale: Locale;
}) {
  const [step, setStep] = useState<"closed" | "form" | "confirm">(initial !== null ? "form" : "closed");
  const [values, setValues] = useState<ConditionInput>(
    initial ?? { condition: next[0]?.value ?? "", cause: "", effectiveFrom: "", reportedAt: "", premises: "", pending: "", ground: "" },
  );
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<ConditionInput>) => setValues((current) => ({ ...current, ...patch }));
  const transfer = values.condition === "TRANSFERRED";
  const lossLike = values.condition === "LOST" || values.condition === "COMPROMISED";
  const conditionLabel = next.find((option) => option.value === values.condition)?.label ?? "";
  const causeLabel = (causes[values.condition] ?? []).find((option) => option.value === values.cause)?.label ?? "";
  const target = transferTo.find((option) => option.value === values.premises)?.label ?? "";
  const when = values.effectiveFrom === "" ? words.noTime : (format.timestamp(values.effectiveFrom, locale) ?? values.effectiveFrom);
  const fill = (template: string) => template.replace("{id}", device).replace("{s}", conditionLabel).replace("{p}", target).replace("{from}", premises).replace("{e}", when).replace("{n}", String(waiting));

  const facts = [
    { label: words.fDevice, value: device, kind: "id" as const },
    ...(transfer
      ? [
          { label: words.fFrom, value: premises },
          { label: words.fTo, value: target },
        ]
      : [
          { label: words.fCondition, value: conditionLabel },
          { label: words.fCause, value: causeLabel },
        ]),
    values.effectiveFrom === "" ? { label: words.fEffective, value: words.noTime } : { label: words.fEffective, value: values.effectiveFrom, kind: "datetime" as const },
    ...(lossLike && values.reportedAt !== "" ? [{ label: words.fReported, value: values.reportedAt, kind: "datetime" as const }] : []),
    ...(transfer && waiting > 0 && values.pending !== ""
      ? [{ label: fill(words.fPending), value: values.pending === "discard" ? words.fPendingDiscard : fill(words.fPendingSubmit) }]
      : []),
    ...(transfer && values.ground !== "" ? [{ label: words.fGround, value: values.ground }] : []),
  ];

  return (
    <>
      <ShortcutButton variant="primary" size="sm" shortcut="Alt+R" {...(disabledReason !== null ? { disabled: true, disabledReason } : {})} onClick={() => setStep("form")} locale={locale}>
        {words.record}
      </ShortcutButton>
      <form ref={form} action={recordCondition.bind(null, device)} style={{ display: "none" }}>
        <input type="hidden" name="condition" value={values.condition} />
        <input type="hidden" name="cause" value={values.cause} />
        <input type="hidden" name="effective_from" value={values.effectiveFrom} />
        <input type="hidden" name="reported_at" value={lossLike ? values.reportedAt : ""} />
        <input type="hidden" name="premises_id" value={transfer ? values.premises : ""} />
        <input type="hidden" name="pending_evidence_decision" value={transfer ? values.pending : ""} />
        <input type="hidden" name="discard_ground" value={transfer ? values.ground : ""} />
      </form>
      {step === "form" ? (
        <Dialog
          title={fill(words.formTitle)}
          description={transfer ? fill(words.formDescTransfer) : words.formDesc}
          primaryAction={{ label: transfer ? words.nextTransfer : words.next, variant: "primary", onClick: () => setStep("confirm") }}
          secondaryAction={{ label: words.keep, onClick: () => setStep("closed") }}
          onClose={() => setStep("closed")}
          open
          placement="viewport"
          align="start"
          autoFocus={false}
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          {refusal !== null ? (
            <Banner family="neutral" title={refusal.title} code={refusal.code} compact density="console" locale={locale}>
              {refusal.text}
            </Banner>
          ) : null}
          <Select
            label={words.condition}
            options={[...next]}
            value={values.condition}
            onChange={(condition) => set({ condition, cause: "" })}
            required
            {...(field === "condition" ? { error: words.conditionMissing } : {})}
            density="console"
            locale={locale}
          />
          <Select
            label={words.cause}
            options={[...(causes[values.condition] ?? [])]}
            {...(values.cause !== "" ? { value: values.cause } : {})}
            placeholder={words.choose}
            onChange={(cause) => set({ cause })}
            required
            density="console"
            locale={locale}
          />
          <DateField
            withTime
            label={lossLike ? words.effectiveLost : words.effective}
            helper={lossLike ? words.effectiveHelpLost : words.effectiveHelp}
            {...(values.effectiveFrom !== "" ? { value: values.effectiveFrom.slice(0, 10), time: values.effectiveFrom.slice(11, 16) } : {})}
            onChange={(chosen) => set({ effectiveFrom: typeof chosen === "string" ? chosen : "" })}
            required
            density="console"
            locale={locale}
          />
          {lossLike ? (
            <DateField
              withTime
              label={words.reported}
              helper={words.reportedHelp}
              {...(values.reportedAt !== "" ? { value: values.reportedAt.slice(0, 10), time: values.reportedAt.slice(11, 16) } : {})}
              onChange={(chosen) => set({ reportedAt: typeof chosen === "string" ? chosen : "" })}
              {...(field === "reported" ? { error: words.reportedInvalid } : {})}
              density="console"
              locale={locale}
            />
          ) : null}
          {transfer ? (
            <>
              <Combobox
                wrap
                label={words.newPremises}
                helper={words.cross}
                options={transferTo.map((option) => ({ value: option.value, label: option.label, ...(option.detail !== null ? { detail: option.detail } : {}) }))}
                {...(values.premises !== "" ? { value: values.premises } : {})}
                onChange={(chosen) => set({ premises: typeof chosen === "string" ? chosen : "" })}
                required
                {...(field === "premises" ? { error: words.premisesMissing } : {})}
                density="console"
                locale={locale}
              />
              {waiting > 0 ? (
                <ChoiceList
                  legend={fill(words.pending)}
                  options={[
                    { value: "submit_to_former", label: fill(words.optSubmit) },
                    { value: "discard", label: fill(words.optDiscard), hint: words.discardHint },
                  ]}
                  {...(values.pending !== "" ? { value: values.pending } : {})}
                  onChange={(event) => set({ pending: (event as { target: { value: string } }).target.value })}
                  required
                  density="console"
                  locale={locale}
                />
              ) : null}
              <TextField
                label={words.ground}
                helper={words.groundHelp}
                value={values.ground}
                onChange={(ground) => set({ ground })}
                required={values.pending === "discard"}
                multiline
                rows={2}
                density="console"
                locale={locale}
              />
            </>
          ) : null}
        </Dialog>
      ) : null}
      {step === "confirm" ? (
        <Dialog
          title={transfer ? fill(words.cfTitleTransfer) : fill(words.cfTitle)}
          description={transfer ? fill(words.cfTextTransfer) : values.condition === "LOST" || values.condition === "COMPROMISED" ? fill(words.cfTextLost) : fill(words.cfText)}
          primaryAction={{
            label: transfer ? words.confirmTransfer : words.confirm,
            variant: values.condition === "ACTIVE" ? "primary" : "danger",
            loading: sending,
            onClick: () => {
              setSending(true);
              form.current?.requestSubmit();
            },
          }}
          secondaryAction={{ label: words.keep, onClick: () => setStep("closed") }}
          onClose={() => setStep("closed")}
          open
          placement="viewport"
          align="start"
          autoFocus={false}
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          <FactList items={facts} locale={locale} />
        </Dialog>
      ) : null}
    </>
  );
}

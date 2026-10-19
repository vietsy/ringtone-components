"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  ButtonRow,
  ChoiceList,
  Combobox,
  DateField,
  Divider,
  FactList,
  FieldRow,
  FieldRows,
  Panel,
  StatusLine,
  TextField,
} from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";

export interface ProposalWords {
  proposed: string;
  outcomes: { value: string; label: string }[];
  needsApproval: string;
  noApproval: string;
  effective: string;
  effectiveHelp: string;
  fee: string;
  feeNote: string;
  feeNone: string;
  feeUnknown: string;
  statement: string;
  statementNote: string;
  reason: string;
  reasonPick: string;
  reasonHelp: string;
  reasons: { value: string; label: string }[];
  outcomeText: string;
  outcomeHelp: string;
  notMet: string;
  notMetHelp: string;
  addCondition: string;
  /** Carries {n}. */
  conditionTitle: string;
  condition: string;
  canDo: string;
  canDoHelp: string;
  appeal: string;
  appealValue: string;
  send: string;
  issue: string;
  sendWhy: string;
  cancel: string;
  sendTitle: string;
  sendText: string;
  issueTitle: string;
  issueText: string;
  back: string;
}

/** The dates the decision is measured against, and the line said when it is expected after the fee falls due. */
export interface ProposalDates {
  title: string;
  items: { label: string; value: string | null; kind: "date" }[];
  after: { text: string; detail: string } | null;
}

/** A refusal said above the action row. */
export interface ProposalNotice {
  family: "neutral" | "attention";
  title: string;
  code: string;
  text: string;
}

export interface ProposalValues {
  outcome: string;
  reason: string;
  text: string;
  unmet: readonly string[];
  actionOpen: string;
  effectiveFrom: string;
}

/**
 * SCR-REG-13's form. The outcome decides the rest: as applied for, it is issued at once and needs no statement;
 * otherwise or refused, it needs its statement - the reason, the outcome in one sentence, each condition not met
 * and what the applicant can do - and waits for an approver. The primary act is Issue the decision or Send for
 * approval, never both, and each asks before it sends.
 */
export function ProposalFields({
  formId,
  words,
  initial,
  fees,
  amends,
  fieldErrors,
  dates,
  banner,
  cancelHref,
  locale,
}: {
  formId: string;
  words: ProposalWords;
  initial: ProposalValues;
  /** TAR's fee on each outcome, in words; null where no approved tariff answers it. */
  fees: { asApplied: string | null; otherwise: string | null };
  /** An amendment: the earliest Effective from, as an ISO date and in words. */
  amends: { registeredOn: string } | null;
  fieldErrors: { statement: string | null; effective: string | null };
  dates: ProposalDates;
  banner: ProposalNotice | null;
  cancelHref: string;
  locale: Locale;
}) {
  const [outcome, setOutcome] = useState(initial.outcome);
  const [reason, setReason] = useState(initial.reason);
  const [text, setText] = useState(initial.text);
  const [unmet, setUnmet] = useState<string[]>(initial.unmet.length > 0 ? [...initial.unmet] : [""]);
  const [actionOpen, setActionOpen] = useState(initial.actionOpen);
  const asApplied = outcome === "DECIDED_AS_APPLIED";
  const adverse = outcome === "DECIDED_OTHERWISE" || outcome === "REFUSED";
  const complete = reason.trim() !== "" && text.trim() !== "" && unmet.some((line) => line.trim() !== "") && actionOpen.trim() !== "";
  const fee = outcome === "REFUSED" ? null : asApplied ? fees.asApplied : fees.otherwise;
  const outcomeWords = words.outcomes.find((option) => option.value === outcome)?.label ?? "";
  const feeFact = {
    label: words.fee,
    value: outcome === "REFUSED" || fee === null ? null : fee,
    missing: outcome === "REFUSED" ? words.feeNone : words.feeUnknown,
    ...(fee !== null ? { note: words.feeNote } : {}),
  };
  return (
    <Panel gap="xl" locale={locale}>
      <Panel variant="plain" compact locale={locale}>
        <ChoiceList
          legend={words.proposed}
          name="proposed_outcome"
          options={words.outcomes}
          value={outcome}
          layout="inline"
          required
          onChange={(event) => setOutcome(String((event as { target: { value: string } }).target.value))}
          density="console"
          locale={locale}
        />
        {outcome !== "" ? <StatusLine family="info" text={asApplied ? words.noApproval : words.needsApproval} cutout="surface" locale={locale} /> : null}
        {amends !== null ? (
          <DateField
            label={words.effective}
            helper={words.effectiveHelp}
            name="effective_from"
            value={initial.effectiveFrom}
            min={amends.registeredOn}
            {...(fieldErrors.effective !== null ? { error: fieldErrors.effective } : {})}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
        ) : null}
        {outcome !== "" ? <FactList items={[feeFact]} density="console" locale={locale} /> : null}
      </Panel>
      <Divider />
      {adverse ? (
        <>
          <Panel variant="plain" level={2} title={words.statement} description={words.statementNote} compact locale={locale}>
            <Combobox
              label={words.reason}
              name="reason_code"
              options={words.reasons}
              {...(reason !== "" ? { value: reason } : {})}
              placeholder={words.reasonPick}
              helper={words.reasonHelp}
              allowCustom
              required
              width="100%"
              onChange={(value) => setReason(typeof value === "string" ? value : "")}
              density="console"
              locale={locale}
            />
            <TextField
              label={words.outcomeText}
              helper={words.outcomeHelp}
              name="reason_text"
              value={text}
              onChange={setText}
              required
              wrap
              width="100%"
              density="console"
              locale={locale}
            />
            <FieldRows
              legend={words.notMet}
              helper={words.notMetHelp}
              required
              count={unmet.length}
              addLabel={words.addCondition}
              onAdd={() => setUnmet((before) => [...before, ""])}
              {...(fieldErrors.statement !== null ? { error: fieldErrors.statement } : {})}
              density="console"
              locale={locale}
            >
              {unmet.map((line, index) => (
                <FieldRow
                  key={index}
                  title={words.conditionTitle.replace("{n}", String(index + 1))}
                  removable={unmet.length > 1}
                  onRemove={() => setUnmet((before) => before.filter((_, at) => at !== index))}
                  density="console"
                  locale={locale}
                >
                  <TextField
                    label={words.condition}
                    name={`unmet_conditions[${String(index)}].text`}
                    value={line}
                    onChange={(value) => setUnmet((before) => before.map((entry, at) => (at === index ? value : entry)))}
                    wrap
                    width="100%"
                    density="console"
                    locale={locale}
                  />
                </FieldRow>
              ))}
            </FieldRows>
            <TextField
              label={words.canDo}
              helper={words.canDoHelp}
              name="action_open"
              value={actionOpen}
              onChange={setActionOpen}
              required
              wrap
              width="100%"
              density="console"
              locale={locale}
            />
            <FactList items={[{ label: words.appeal, value: words.appealValue }]} density="console" locale={locale} />
          </Panel>
          <Divider />
        </>
      ) : null}
      <Panel variant="plain" level={2} title={dates.title} compact locale={locale}>
        <FactList items={dates.items} density="console" locale={locale} />
        {dates.after !== null ? <StatusLine family="attention" text={dates.after.text} detail={dates.after.detail} cutout="surface" locale={locale} /> : null}
      </Panel>
      {banner !== null ? (
        <Banner family={banner.family} title={banner.title} code={banner.code} compact density="console" live locale={locale}>
          {banner.text}
        </Banner>
      ) : null}
      <Divider />
      <ButtonRow>
        {asApplied ? (
          <ConfirmSubmit
            formId={formId}
            label={words.issue}
            shortcut="Alt+R"
            dialog={{ title: words.issueTitle, description: words.issueText, confirm: words.issue, back: words.back }}
            locale={locale}
          >
            <FactList items={[{ label: words.proposed, value: outcomeWords }, feeFact]} density="console" locale={locale} />
          </ConfirmSubmit>
        ) : (
          <ConfirmSubmit
            formId={formId}
            label={words.send}
            shortcut="Alt+R"
            disabledReason={adverse && complete ? null : words.sendWhy}
            dialog={{ title: words.sendTitle, description: words.sendText, confirm: words.send, back: words.back }}
            locale={locale}
          >
            <FactList items={[{ label: words.proposed, value: outcomeWords }, feeFact]} density="console" locale={locale} />
          </ConfirmSubmit>
        )}
        <Button variant="quiet" size="sm" href={cancelHref} locale={locale}>
          {words.cancel}
        </Button>
      </ButtonRow>
    </Panel>
  );
}

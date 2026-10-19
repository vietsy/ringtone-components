"use client";

import type { Route } from "next";
import { useState } from "react";
import { Banner, Button, ButtonRow, ChoiceList, Combobox, DateField, Divider, Panel, Select, StatusLine, TextField } from "@/components/r1";
import type { GrantForm as GrantData, PartyAttempt } from "@/lib/api/parties";
import { APPROVAL_LEVELS } from "@/lib/api/parties-terms";
import type { Locale } from "@/lib/i18n/translate";
import { DELEGATE_ACTS, day, partyTranslator, refusal } from "./copy";
import { readDate } from "./fields";
import { FileField } from "./FileField";
import { SubmitButton } from "./SubmitButton";

const one = (value: string | readonly string[] | undefined): string => (typeof value === "string" ? value : "");
const many = (value: string | readonly string[] | undefined): string[] => (typeof value === "string" ? [value] : value !== undefined ? [...value] : []);

/**
 * SCR-PTY-12's grant: who and where (a person already on the party's record - one nobody has recorded is refused, not
 * created, @AC-FR-PTY-001-03 - the whole party or one of its premises, by name or register record), what they may do,
 * the basis and its evidence, and the period. Leaving the end date empty states the consequence at once: with no
 * approved delegation standard the grant will be refused, not held, so the page asks for an end date (FR-PTY-026,
 * finding F-5); once a standard fixes a level, the approver and the level the approval was given at are asked for.
 */
export function GrantForm({
  data,
  action,
  cancelHref,
  attempt,
  phone,
  locale,
}: {
  data: GrantData;
  action: (formData: FormData) => Promise<void>;
  cancelHref: Route;
  attempt: PartyAttempt | null;
  phone: boolean;
  locale: Locale;
}) {
  const t = partyTranslator(locale);
  const values = attempt?.values ?? {};
  const failed = attempt?.refusal ?? null;
  const [scope, setScope] = useState(one(values.scope) || "premises");
  const [premises, setPremises] = useState(one(values.premises_id));
  const [other, setOther] = useState(one(values.premises_id) !== "" && !data.premises.some((entry) => entry.record === one(values.premises_id)));
  const [to, setTo] = useState<string | null>(readDate(one(values["effective_period-to"])));
  const from = readDate(one(values["effective_period-from"])) ?? data.today;
  const fieldError = (field: string) => (failed !== null && failed.field === field ? refusal(t, failed.code, "pty12", failed.values).text : null);
  const banner = failed !== null && failed.field === null ? refusal(t, failed.code, "pty12", failed.values) : null;
  const width = phone ? "100%" : "var(--container-xs)";
  const standard = data.delegationStandard;
  const consequence =
    to === null
      ? { family: "attention" as const, text: t("pty12.consOpenText"), detail: standard === null ? t("pty12.consOpenDetail") : t("pty12.consOpenStdDetail", { level: t(`party.level.${standard.level}`) }) }
      : { family: "info" as const, text: t("pty12.consDatedText"), detail: t("pty12.consDatedDetail", { d: day(to, locale) }) };

  return (
    <form action={action} noValidate>
      <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Panel variant="plain" level={2} title={t("pty12.secWho")} density="portal" locale={locale}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Combobox
              label={t("pty12.fPerson")}
              helper={t("pty12.fPersonHelp")}
              name="party_person_id"
              options={data.persons.map((person) => ({ value: person.reference, label: person.name, detail: person.reference }))}
              {...(one(values.party_person_id) !== "" ? { value: one(values.party_person_id) } : {})}
              wrap
              {...(fieldError("party_person_id") !== null ? { error: fieldError("party_person_id") ?? "" } : {})}
              required
              width={width}
              density="portal"
              locale={locale}
            />
            <ChoiceList
              legend={t("pty12.fScope")}
              name="scope"
              options={[
                { value: "party", label: t("pty11.partyWide") },
                { value: "premises", label: t("pty12.scopePremises") },
              ]}
              value={scope}
              onChange={(event) => {
                const target = (event as { target?: { value?: string } }).target;
                if (target?.value !== undefined) setScope(target.value);
              }}
              required
              density="portal"
              locale={locale}
            />
            {scope === "premises" && !phone ? (
              <Combobox
                label={t("pty12.fPremises")}
                helper={t("pty12.fPremisesHelp")}
                name="premises_id"
                options={data.premises.map((entry) => ({ value: entry.record, label: entry.name, detail: entry.record }))}
                {...(premises !== "" ? { value: premises } : {})}
                onChange={(value) => setPremises(typeof value === "string" ? value : "")}
                allowCustom
                customLabel={t("pty12.useRecord")}
                wrap
                {...(fieldError("premises_id") !== null ? { error: fieldError("premises_id") ?? "" } : {})}
                required
                width="100%"
                density="portal"
                locale={locale}
              />
            ) : null}
            {scope === "premises" && phone ? (
              <>
                <input type="hidden" name="premises_id" value={premises} />
                <ChoiceList
                  legend={t("pty12.fPremises")}
                  options={[...data.premises.map((entry) => ({ value: entry.record, label: entry.name })), { value: "other", label: t("pty12.otherRecord") }]}
                  value={other ? "other" : premises}
                  onChange={(event) => {
                    const target = (event as { target?: { value?: string } }).target;
                    if (target?.value === undefined) return;
                    setOther(target.value === "other");
                    setPremises(target.value === "other" ? "" : target.value);
                  }}
                  required
                  density="portal"
                  locale={locale}
                />
                {other ? (
                  <TextField
                    label={t("pty12.fRecord")}
                    helper={t("pty12.fRecordHelp")}
                    value={premises}
                    onChange={setPremises}
                    {...(fieldError("premises_id") !== null ? { error: fieldError("premises_id") ?? "" } : {})}
                    mono
                    required
                    width="100%"
                    density="portal"
                    locale={locale}
                  />
                ) : null}
              </>
            ) : null}
            <ChoiceList
              legend={t("pty12.fActs")}
              name="scope_keys"
              options={DELEGATE_ACTS.map((act) => ({ value: act, label: t(`party.act.${act}`) }))}
              value={many(values.scope_keys).length > 0 ? many(values.scope_keys) : ["READ", "SUBMIT"]}
              multiple
              layout="inline"
              {...(fieldError("scope_keys") !== null ? { error: fieldError("scope_keys") ?? "" } : {})}
              required
              density="portal"
              locale={locale}
            />
          </div>
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("pty12.secBasis")} density="portal" locale={locale}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <TextField
              label={t("pty12.fBasis")}
              helper={t("pty12.fBasisHelp")}
              name="basis"
              value={one(values.basis)}
              {...(fieldError("basis") !== null ? { error: fieldError("basis") ?? "" } : {})}
              required
              wrap
              width="100%"
              density="portal"
              locale={locale}
            />
            <TextField
              label={t("pty12.fEvidence")}
              helper={t("pty12.fEvidenceHelp")}
              name="evidence_ref"
              value={one(values.evidence_ref)}
              {...(fieldError("evidence_ref") !== null ? { error: fieldError("evidence_ref") ?? "" } : {})}
              mono
              required
              width={phone ? "100%" : "var(--space-64)"}
              density="portal"
              locale={locale}
            />
            <FileField
              name="evidence_file"
              label={t("pty12.fFile")}
              helper={t("pty12.fFileHelp")}
              sizeWords={t("party.sizeKb")}
              by=""
              initial={one(values.evidence_file_name) !== "" ? { name: one(values.evidence_file_name), type: one(values.evidence_file_type), sizeBytes: Number(one(values.evidence_file_size)) || 0 } : null}
              density="portal"
              locale={locale}
            />
          </div>
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("pty12.secPeriod")} density="portal" locale={locale}>
          <DateField
            label={t("pty12.fPeriod")}
            range
            fromLabel={t("party.from")}
            toLabel={t("party.to")}
            name="effective_period"
            value={from}
            {...(to !== null ? { to } : {})}
            toPlaceholder={t("party.noEnd")}
            onChange={(value) => {
              if (value !== null && typeof value === "object") setTo(value.to);
            }}
            {...(fieldError("effective_period") !== null ? { error: fieldError("effective_period") ?? "" } : {})}
            required
            today={data.today}
            min={data.today}
            density="portal"
            locale={locale}
          />
          <StatusLine family={consequence.family} text={consequence.text} detail={consequence.detail} cutout="surface" locale={locale} />
          {to === null && standard !== null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              <Combobox
                label={t("pty12.fApprover")}
                helper={t("pty12.fApproverHelp")}
                name="approval_authority_ref"
                options={data.approvers.map((person) => ({ value: person.reference, label: person.name, detail: person.reference }))}
                {...(one(values.approval_authority_ref) !== "" ? { value: one(values.approval_authority_ref) } : {})}
                wrap
                {...(fieldError("approval_authority_ref") !== null ? { error: fieldError("approval_authority_ref") ?? "" } : {})}
                width={width}
                density="portal"
                locale={locale}
              />
              <Select
                label={t("pty12.fLevel")}
                name="approval_level"
                options={APPROVAL_LEVELS.map((level) => ({ value: level, label: t(`party.level.${level}`) }))}
                value={one(values.approval_level) || standard.level}
                {...(fieldError("approval_level") !== null ? { error: fieldError("approval_level") ?? "" } : {})}
                width={width}
                density="portal"
                locale={locale}
              />
            </div>
          ) : null}
        </Panel>
        <Divider />
        {banner !== null ? (
          <Banner family={failed?.code === "NO_DELEGATION_STANDARD" ? "neutral" : "attention"} title={banner.title} code={banner.code} density="portal" live locale={locale}>
            {banner.text}
          </Banner>
        ) : null}
        <ButtonRow>
          <SubmitButton variant="primary" size="md" loadingLabel={t("pty12.granting")} fullWidth={phone} locale={locale}>
            {t("pty12.grant")}
          </SubmitButton>
          <Button variant="quiet" size="md" href={cancelHref} fullWidth={phone} locale={locale}>
            {t("party.cancel")}
          </Button>
        </ButtonRow>
      </Panel>
    </form>
  );
}

"use client";

import type { Route } from "next";
import { useState } from "react";
import { Banner, Button, ButtonRow, ChoiceList, DateField, Divider, FactList, Panel, StatusLine } from "@/components/r1";
import type { AmendForm as AmendData, PartyAttempt } from "@/lib/api/parties";
import type { Locale } from "@/lib/i18n/translate";
import { DELEGATE_ACTS, actsWords, day, moment, partyTranslator, refusal, scopeWords, shortDay, wordsOf } from "./copy";
import { readDate } from "./fields";
import { SubmitButton } from "./SubmitButton";

const one = (value: string | readonly string[] | undefined): string => (typeof value === "string" ? value : "");
const many = (value: string | readonly string[] | undefined): string[] => (typeof value === "string" ? [value] : value !== undefined ? [...value] : []);

/**
 * SCR-PTY-12's amendment: the person, the premises, the basis and the evidence stay as they are; the principal changes
 * what the person may do and the period, from a date. The current version closes where the new one starts and stays
 * readable with the period it covered (FR-PTY-006).
 */
export function AmendForm({
  data,
  action,
  cancelHref,
  attempt,
  phone,
  locale,
}: {
  data: AmendData;
  action: (formData: FormData) => Promise<void>;
  cancelHref: Route;
  attempt: PartyAttempt | null;
  phone: boolean;
  locale: Locale;
}) {
  const t = partyTranslator(locale);
  const authority = data.authority;
  const values = attempt?.values ?? {};
  const failed = attempt?.refusal ?? null;
  const [from, setFrom] = useState(readDate(one(values["effective_period-from"])) ?? data.today);
  const to = readDate(one(values["effective_period-to"])) ?? authority.to;
  const current = authority.versions.find((version) => version.role === "CURRENT" || version.role === "NOT_STARTED") ?? authority.versions[0];
  // A backdated version names the act it would cover in a banner of its own, so the period field carries no second copy.
  const fieldError = (field: string) =>
    failed !== null && failed.field === field && failed.code !== "AMENDMENT_BACKDATED_OVER_PERFORMED_ACT" ? refusal(t, failed.code, "pty12", failed.values).text : null;
  const banner = failed !== null && failed.field === null ? refusal(t, failed.code, "pty12", failed.values) : null;
  const acted = failed?.code === "AMENDMENT_BACKDATED_OVER_PERFORMED_ACT" ? failed.values : null;

  return (
    <form action={action} noValidate>
      <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Panel variant="plain" level={2} title={t("pty12.secAuthority")} description={t("pty12.secAuthorityDesc")} density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("pty12.fRef"), value: authority.reference, kind: "id" },
              { label: t("pty12.fPersonShort"), value: authority.person },
              { label: t("pty12.fScopeShort"), value: scopeWords(authority.premises, t) },
              { label: t("pty12.fBasisShort"), value: authority.basis !== null ? wordsOf(authority.basis, "basis", t) : null, missing: t("party.notRecorded") },
              { label: t("pty12.fEvidenceShort"), value: authority.evidence, kind: "id", missing: t("party.notRecorded") },
              ...(current !== undefined ? [{ label: t("pty12.fCurrent"), value: t("pty12.currentVal", { acts: actsWords(current.acts, t), d: shortDay(current.from, locale) }) }] : []),
            ]}
            density="portal"
            locale={locale}
          />
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("pty12.secNew")} density="portal" locale={locale}>
          <ChoiceList
            legend={t("pty12.fActs")}
            name="scope_keys"
            options={DELEGATE_ACTS.map((act) => ({ value: act, label: t(`party.act.${act}`) }))}
            value={many(values.scope_keys).length > 0 ? many(values.scope_keys) : [...authority.acts]}
            multiple
            layout="inline"
            {...(fieldError("scope_keys") !== null ? { error: fieldError("scope_keys") ?? "" } : {})}
            required
            density="portal"
            locale={locale}
          />
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("pty12.secPeriodNew")} density="portal" locale={locale}>
          <DateField
            label={t("pty12.fPeriodNew")}
            range
            fromLabel={t("party.from")}
            toLabel={t("party.to")}
            name="effective_period"
            value={from}
            {...(to !== null ? { to } : {})}
            toPlaceholder={t("party.noEnd")}
            onChange={(value) => {
              if (value !== null && typeof value === "object" && value.from !== null) setFrom(value.from);
            }}
            {...(fieldError("effective_period") !== null ? { error: fieldError("effective_period") ?? "" } : {})}
            required
            today={data.today}
            density="portal"
            locale={locale}
          />
          <StatusLine family="info" text={t("pty12.consAmendText", { d: day(from, locale) })} cutout="surface" locale={locale} />
          {acted !== null ? (
            <Banner family="attention" title={t(`party.performed.${acted.act ?? ""}`, { person: authority.person, subject: acted.subject ?? "", ts: moment(acted.at ?? "", locale) })} code="AMENDMENT_BACKDATED_OVER_PERFORMED_ACT" density="portal" live locale={locale}>
              {t("party.refusal.AMENDMENT_BACKDATED_OVER_PERFORMED_ACT.text")}
            </Banner>
          ) : null}
        </Panel>
        <Divider />
        {banner !== null ? (
          <Banner family="attention" title={banner.title} code={banner.code} density="portal" live locale={locale}>
            {banner.text}
          </Banner>
        ) : null}
        <ButtonRow>
          <SubmitButton variant="primary" size="md" fullWidth={phone} locale={locale}>
            {t("pty12.saveVersion")}
          </SubmitButton>
          <Button variant="quiet" size="md" href={cancelHref} fullWidth={phone} locale={locale}>
            {t("party.cancel")}
          </Button>
        </ButtonRow>
      </Panel>
    </form>
  );
}

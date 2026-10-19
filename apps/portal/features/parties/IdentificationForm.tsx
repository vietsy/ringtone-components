"use client";

import type { Route } from "next";
import { useState } from "react";
import {
  Banner,
  Button,
  ButtonRow,
  ChoiceList,
  Columns,
  Combobox,
  Divider,
  FactList,
  Panel,
  Select,
  StatusLine,
  TextField,
} from "@/components/r1";
import type { IdentificationForm as FormData, PartyAttempt } from "@/lib/api/parties";
import { EVIDENCE_KINDS, IDENTIFIER_KINDS } from "@/lib/api/parties-terms";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { evidenceWords, moment, partyTranslator, refusal } from "./copy";
import { FileField } from "./FileField";
import { SubmitButton } from "./SubmitButton";

const one = (value: string | readonly string[] | undefined): string => (typeof value === "string" ? value : "");

/**
 * SCR-PTY-03's form: the route, chosen between the source and a manual declaration, with how the source stands as a
 * line of text beside it and never as a disabled route (FR-PTY-023). The sourced route searches by an identifier the
 * source accepts; the manual route takes the evidence, its reference, a scan and the reason, and says before Declare
 * what DR-200 will do with the declaration. Declare asks first: the declaration cannot be changed afterwards.
 */
export function IdentificationForm({
  data,
  search,
  declare,
  partyHref,
  attempt,
  locale,
}: {
  data: FormData;
  search: (formData: globalThis.FormData) => Promise<void>;
  declare: (formData: globalThis.FormData) => Promise<void>;
  partyHref: Route;
  attempt: PartyAttempt | null;
  locale: Locale;
}) {
  const t = partyTranslator(locale);
  const values = attempt?.values ?? {};
  const failed = attempt?.refusal ?? null;
  const offered = data.source.condition !== "NOT_CONFIGURED";
  const [route, setRoute] = useState(attempt?.form === "search" && offered ? "SOURCED" : "MANUAL");
  const [evidenceKind, setEvidenceKind] = useState(one(values.evidence_kind));
  const [evidenceRef, setEvidenceRef] = useState(one(values.evidence_ref));
  const [reason, setReason] = useState(one(values.reason));
  const [touched, setTouched] = useState(false);

  const fieldError = (field: string) => (failed !== null && failed.field === field ? refusal(t, failed.code, "pty03").text : null);
  const reach =
    data.source.condition === "REACHABLE"
      ? { family: "positive" as const, text: t("pty03.reachable"), detail: t("pty03.reachableDetail", { ts: moment(data.source.probedAt, locale) }) }
      : data.source.condition === "UNREACHABLE"
        ? { family: "attention" as const, text: t("pty03.unreachable"), detail: t("pty03.unreachableDetail", { ts: moment(data.source.probedAt, locale) }) }
        : { family: "neutral" as const, text: t("pty03.noSource"), detail: t("pty03.noSourceDetail") };
  const noMatch = data.source.condition === "REACHABLE" && data.lastSearch !== null && !data.lastSearch.matched;
  const outcome =
    data.source.condition === "NOT_CONFIGURED" ? "stands" : data.source.condition === "UNREACHABLE" ? "forced" : noMatch ? "review" : "chosen";
  const missingEvidence = evidenceKind.trim() === "" || evidenceRef.trim() === "";
  const missingReason = reason.trim() === "";
  const held = missingEvidence ? t("pty03.whyEmpty") : missingReason ? t("pty03.whyReason") : null;
  const reasonError = fieldError("reason") ?? (touched && missingReason ? t("party.refusal.MANUAL_FIELDS_INCOMPLETE.text") : null);
  const sourceFact = noMatch && data.lastSearch !== null ? t("pty03.sourceLine", { id: data.lastSearch.identifier }) : t(`party.sourceCondition.${data.source.condition}`);

  return (
    <Panel gap="xl" locale={locale}>
      {data.source.condition === "NOT_CONFIGURED" ? (
        <Banner family="neutral" title={t("pty03.nsTitle")} code="SOURCE_NOT_CONFIGURED" level={2} density="console" locale={locale}>
          {t("pty03.nsText")}
        </Banner>
      ) : null}
      <Panel variant="plain" level={2} title={t("pty03.routeTitle")} compact locale={locale}>
        <Columns layout="halves">
          <ChoiceList
            legend={t("pty03.route")}
            name="route"
            options={[
              ...(offered ? [{ value: "SOURCED", label: t("pty03.fromSource"), helper: t("pty03.fromSourceHelp") }] : []),
              { value: "MANUAL", label: t("pty03.manual"), helper: t("pty03.manualHelp") },
            ]}
            value={route}
            onChange={(event) => {
              const target = (event as { target?: { value?: string } }).target;
              if (target?.value !== undefined) setRoute(target.value);
            }}
            required
            density="console"
            locale={locale}
          />
          <StatusLine family={reach.family} text={reach.text} detail={reach.detail} cutout="surface" locale={locale} />
        </Columns>
        {data.lastSearch !== null ? (
          <FactList
            items={[
              { label: t("pty03.lastSearch"), value: t("pty03.searchedBy", { kind: t(`party.identifier.${data.lastSearch.identifierKind}`), id: data.lastSearch.identifier }) },
              { label: t("pty03.result"), value: data.lastSearch.matched ? t("pty03.match") : t(`pty03.noMatch.${data.kind}`) },
              { label: t("pty03.searchedAt"), value: data.lastSearch.at, kind: "datetime" },
            ]}
            density="console"
            locale={locale}
          />
        ) : null}
      </Panel>
      <Divider />
      {route === "SOURCED" ? (
        <form action={search} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Panel variant="plain" level={2} title={t("pty03.searchTitle")} description={t("pty03.searchDesc")} compact locale={locale}>
              <Select
                label={t("pty03.idKind")}
                helper={t("pty03.idKindHelp")}
                name="identifier_kind"
                options={IDENTIFIER_KINDS.map((kind) => ({ value: kind, label: t(`party.identifier.${kind}`) }))}
                value={one(values.identifier_kind) || "BUSINESS_REGISTRATION_NUMBER"}
                {...(fieldError("identifier_kind") !== null ? { error: fieldError("identifier_kind") ?? "" } : {})}
                required
                density="console"
                width="var(--space-96)"
                locale={locale}
              />
              <FactList items={[{ label: t("pty03.identifier"), value: data.businessRegistration, kind: "mono", note: t("pty03.identifierNote"), missing: t("party.noReg") }]} density="console" locale={locale} />
            </Panel>
            <Divider />
            <StatusLine family="info" text={t("pty03.sourceOutcome")} cutout="surface" locale={locale} />
            <ButtonRow>
              <SubmitButton variant="primary" size="sm" icon="search" locale={locale}>
                {t("pty03.searchSource")}
              </SubmitButton>
              <Button variant="quiet" size="sm" href={partyHref} locale={locale}>
                {t("party.cancel")}
              </Button>
            </ButtonRow>
          </div>
        </form>
      ) : (
        <form id="declaration" action={declare} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Panel variant="plain" level={2} title={t("pty03.manualTitle")} description={t("pty03.manualDesc")} compact locale={locale}>
              <Combobox
                label={t("pty03.evKind")}
                helper={failed?.code === "EVIDENCE_KIND_NOT_PERMITTED" ? t("pty03.evHelpList") : t("pty03.evHelp")}
                name="evidence_kind"
                options={EVIDENCE_KINDS.map((kind) => ({ value: kind, label: t(`party.evidence.${kind}`) }))}
                {...(evidenceKind !== "" ? { value: evidenceKind } : {})}
                onChange={(value) => setEvidenceKind(typeof value === "string" ? value : "")}
                placeholder={t("pty03.evKindPick")}
                allowCustom
                customLabel={t("pty03.evCustom")}
                {...(fieldError("evidence_kind") !== null ? { error: fieldError("evidence_kind") ?? "" } : {})}
                required
                density="console"
                width="100%"
                locale={locale}
              />
              <TextField
                label={t("pty03.evRef")}
                helper={t("pty03.evRefHelp")}
                name="evidence_ref"
                value={evidenceRef}
                onChange={setEvidenceRef}
                {...(fieldError("evidence_ref") !== null ? { error: fieldError("evidence_ref") ?? "" } : {})}
                mono
                required
                density="console"
                width="var(--space-72)"
                locale={locale}
              />
              <FileField name="scan" label={t("pty03.scan")} helper={t("pty03.scanHelp")} sizeWords={t("party.sizeKb")} by={data.officer} initial={null} density="console" locale={locale} />
              <TextField
                label={t("pty03.reason")}
                helper={t("pty03.reasonHelp")}
                name="reason"
                value={reason}
                onChange={(value) => {
                  setReason(value);
                  setTouched(true);
                }}
                {...(reasonError !== null ? { error: reasonError } : {})}
                multiline
                rows={3}
                required
                density="console"
                width="100%"
                locale={locale}
              />
              <FactList items={[{ label: t("pty03.operator"), value: data.officer, note: t("pty03.operatorNote") }]} density="console" locale={locale} />
            </Panel>
            <Divider />
            <StatusLine family="info" text={t(`pty03.out.${outcome}`)} cutout="surface" locale={locale} />
            <ButtonRow>
              <ConfirmSubmit
                formId="declaration"
                label={t("pty03.declare")}
                disabledReason={held}
                dialog={{
                  title: t("pty03.dlgTitle", { name: data.legalName }),
                  description: t(outcome === "review" ? "pty03.dlgTextReview" : "pty03.dlgTextStands"),
                  confirm: t(outcome === "review" ? "pty03.dlgPrimaryReview" : "pty03.dlgPrimaryStands"),
                  back: t("party.goBack"),
                }}
                density="console"
                locale={locale}
              >
                <FactList
                  items={[
                    { label: t("pty03.fRoute"), value: t("pty03.manual") },
                    { label: t("pty03.fSource"), value: sourceFact },
                    { label: t("pty03.fEvidence"), value: evidenceWords(evidenceKind, t) },
                    { label: t("pty03.evRef"), value: evidenceRef, kind: "mono" },
                    { label: t("pty03.fReason"), value: reason },
                  ]}
                  density="console"
                  locale={locale}
                />
              </ConfirmSubmit>
              <Button variant="quiet" size="sm" href={partyHref} locale={locale}>
                {t("party.cancel")}
              </Button>
            </ButtonRow>
          </div>
        </form>
      )}
    </Panel>
  );
}

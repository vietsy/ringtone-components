import { randomUUID } from "node:crypto";
import { Banner, FactList, Link, PageHeader, Panel, StatusLine, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { recordTerms } from "@/features/governance/actions";
import { day, govTranslator, refusalSentence } from "@/features/governance/copy";
import { TermsForm } from "@/features/governance/TermsForm";
import { readForPage } from "@/lib/api/flash";
import { loadParticipationTerms, loadShortName, type TermsAttempt, type TermsPage } from "@/lib/api/governance";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { GOV15_VIEWS, type Gov15View } from "@/lib/mock/governance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-GOV-15 Participation terms. The first and largest thing on the page is the sentence that the organisation
 * keeps its own direct-licensing right: it is a statement, never a control, because nothing may clear it
 * (`BR-GOV-13`). Under it, the terms: not yet recorded, with the date they take effect and Record the terms; or
 * recorded, with when they take effect and when they were recorded.
 */
export default async function ParticipationTermsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const query = await searchParams;
  const [locale, frame, standing, ownShortName] = await Promise.all([getLocale(), getFrame(query), loadParticipationStanding(cmo), loadShortName(cmo)]);
  const t = govTranslator(locale);
  const view = reviewView(query, GOV15_VIEWS);
  const outcome = view === "loading" ? null : await loadParticipationTerms(cmo, view);
  const kept = view === null ? readForPage<TermsAttempt>(query) : null;
  const attempt = kept?.page === "terms" && kept.organisation === cmo.organisation ? kept : null;
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  // The statement stands while the terms load or cannot be read: the organisation is known from the session.
  const shortName = data?.organisation.shortName ?? ownShortName;

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={orgNav("terms", standing.open, locale)}
      account={cmo.account}
      context={orgContext(cmo.organisationName, t("gov.contextLine", { name: cmo.account }), locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: phone ? "100%" : "var(--container-2xl)" }}>
        <PageHeader title={t("gov15.statement", { org: shortName })} locale={locale} />
        <StatusLine family="positive" text={t("gov15.statementSub")} role="note" locale={locale} />
        <ViewState
          view={view === "loading" ? "loading" : failure !== null ? "error" : "populated"}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          {...(failure !== null ? { retryable: failure.retryable } : {})}
          errorText={t("gov15.errorText")}
          density="portal"
          rows={3}
          locale={locale}
        >
          {data !== null ? <Terms data={data} view={view} attempt={attempt} attemptId={typeof query.attempt === "string" ? query.attempt : null} phone={phone} t={t} locale={locale} /> : null}
        </ViewState>
        <Link href={routes.orgMandate()} back variant="standalone" size="touch" locale={locale}>
          {t("gov15.back")}
        </Link>
      </div>
    </PortalShell>
  );
}

function Terms({
  data,
  view,
  attempt,
  attemptId,
  phone,
  t,
  locale,
}: {
  data: TermsPage;
  view: Gov15View | null;
  attempt: TermsAttempt | null;
  attemptId: string | null;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { organisation, current, terms } = data;
  const refusal = attempt?.refusal ?? null;
  const superseded = view === "superseded" || refusal?.code === "TERMS_VERSION_SUPERSEDED";
  // A refusal the form cannot place under its date (a waiver, the range already held) is said above the terms.
  const unplaced = refusal !== null && refusal.field === null && refusal.code !== "TERMS_VERSION_SUPERSEDED" ? refusal : null;
  const version = terms?.version ?? current;
  return (
    <>
      {superseded ? (
        <Banner family="attention" title={t("gov15.supTitle")} code="TERMS_VERSION_SUPERSEDED" density="portal" locale={locale}>
          {t("gov.refusal.TERMS_VERSION_SUPERSEDED")}
        </Banner>
      ) : null}
      {unplaced !== null ? (
        <div aria-live="polite" style={{ minWidth: 0 }}>
          <Banner family="attention" code={unplaced.code} density="portal" locale={locale}>
            {refusalSentence(unplaced, null, t, locale)}
          </Banner>
        </div>
      ) : null}
      {terms !== null ? (
        <Banner family="positive" title={t("gov15.recTitle", { date: day(terms.effectiveFrom, locale) })} density="portal" locale={locale}>
          {t("gov15.recText", { org: organisation.shortName })}
        </Banner>
      ) : null}
      <Panel
        title={t("gov15.termsTitle")}
        level={2}
        {...(terms === null ? { description: t("gov15.notRecorded") } : {})}
        inset={phone ? "sm" : "md"}
        density="portal"
        locale={locale}
      >
        <FactList
          items={[
            { label: t("gov15.fOrg"), value: organisation.name, provenance: "registry-sourced" },
            { label: t("gov15.fVersion"), value: t("gov15.versionValue", { version: version.version, date: day(version.from, locale) }) },
            { label: t("gov15.fRetained"), value: t("gov15.retained") },
            ...(terms !== null
              ? [
                  { label: t("gov15.fTakesEffect"), value: terms.effectiveFrom, kind: "date" as const },
                  { label: t("gov15.fRecordedAt"), value: terms.recordedAt, kind: "datetime" as const },
                ]
              : []),
          ]}
          locale={locale}
        />
        {terms === null ? (
          <TermsForm
            // A refused attempt opens the form afresh with the date as it was entered.
            key={attemptId ?? "fresh"}
            action={recordTerms}
            shortName={organisation.shortName}
            version={current}
            entered={attempt !== null ? attempt.values.effectiveFrom : data.entered}
            error={refusal !== null && refusal.field !== null ? refusalSentence(refusal, "gov.field.terms_from", t, locale) : null}
            idempotencyKey={randomUUID()}
            confirmOnArrival={view === "confirm"}
            review={view !== null}
            phone={phone}
            locale={locale}
          />
        ) : null}
      </Panel>
    </>
  );
}

import { randomUUID } from "node:crypto";
import { Banner, Columns, FactList, ItemList, Link, PageHeader, Panel, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { actOnMandate } from "@/features/governance/actions";
import { day, govTranslator, localised, refusalSentence, rowCount, scopeItems } from "@/features/governance/copy";
import { EMPTY_ROW } from "@/features/governance/fields";
import { MandateDraftForm } from "@/features/governance/MandateDraftForm";
import { readForPage } from "@/lib/api/flash";
import { loadOurMandate, type GovRefusal, type Mandate, type MandateAttempt, type MandateForm, type OurMandate } from "@/lib/api/governance";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { GOV14_VIEWS, type Gov14View } from "@/lib/mock/governance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-GOV-14 Our mandate, the organisation portal's landing. An organisation with no mandate fills in the draft:
 * the granting authority, the evidence, the rights it represents province by province, and the period; it saves
 * the draft on this device or submits it for approval. Once submitted the mandate is read-only, and its state says
 * where it stands: under the copyright authority's review, suspended from a date, or simply what the organisation
 * is recognised as representing.
 */
export default async function OurMandatePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const query = await searchParams;
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(query), loadParticipationStanding(cmo)]);
  const t = govTranslator(locale);
  const view = reviewView(query, GOV14_VIEWS);
  const outcome = view === "loading" ? null : await loadOurMandate(cmo, view, locale);
  const kept = view === null ? readForPage<MandateAttempt>(query) : null;
  const attempt = kept?.page === "mandate" && kept.organisation === cmo.organisation ? kept : null;
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={orgNav("mandate", standing.open, locale)}
      account={cmo.account}
      context={orgContext(cmo.organisationName, t("gov.contextLine", { name: cmo.account }), locale)}
      locale={locale}
    >
      <PageHeader title={t("gov14.title")} locale={locale} />
      <ViewState
        view={view === "loading" ? "loading" : failure !== null ? "error" : "populated"}
        {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
        {...(failure !== null ? { retryable: failure.retryable } : {})}
        errorText={t("gov14.errorText")}
        density="portal"
        rows={4}
        locale={locale}
      >
        {data !== null ? (
          <Body
            data={data}
            view={view}
            attempt={attempt}
            attemptId={typeof query.attempt === "string" ? query.attempt : null}
            phone={phone}
            t={t}
            locale={locale}
          />
        ) : null}
      </ViewState>
      <Link href={routes.orgTerms()} variant="standalone" size="touch" locale={locale}>
        {t("gov14.terms")}
      </Link>
    </PortalShell>
  );
}

function Body({
  data,
  view,
  attempt,
  attemptId,
  phone,
  t,
  locale,
}: {
  data: OurMandate;
  view: Gov14View | null;
  attempt: MandateAttempt | null;
  attemptId: string | null;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { mandate, draft, register, organisation } = data;
  // A refusal that names no field (RANGE_OVERLAP) is said above the form, with its code.
  const unplaced = attempt !== null && attempt.refusal.field === null ? attempt.refusal : null;

  if (mandate !== null) {
    return (
      <>
        {unplaced !== null ? <RefusalBanner refusal={unplaced} t={t} locale={locale} /> : null}
        <ReadOnlyMandate mandate={mandate} data={data} phone={phone} t={t} locale={locale} />
      </>
    );
  }

  // The form opens as last entered: the refused attempt, the draft saved on this device, or one empty row with the
  // only recorded authority chosen, as the board draws it.
  const fresh: MandateForm = { authority: register.authorities[0]?.id ?? "", evidence: null, rows: [EMPTY_ROW], from: null, to: null };
  const initial: MandateForm = attempt?.values ?? (draft !== null ? { authority: draft.authority, evidence: draft.evidence, rows: draft.rows, from: draft.from, to: draft.to } : fresh);
  return (
    <>
      {unplaced !== null ? <RefusalBanner refusal={unplaced} t={t} locale={locale} /> : null}
      <MandateDraftForm
        // A new attempt or a newly saved draft opens the form afresh with what it holds.
        key={attemptId ?? draft?.savedAt ?? "fresh"}
        action={actOnMandate}
        organisation={organisation}
        register={register}
        initial={initial}
        savedAt={draft?.savedAt ?? null}
        refusal={attempt !== null && attempt.refusal.field !== null ? attempt.refusal : null}
        idempotencyKey={randomUUID()}
        confirmOnArrival={view === "confirm"}
        review={view !== null}
        phone={phone}
        locale={locale}
      />
    </>
  );
}

function RefusalBanner({ refusal, t, locale }: { refusal: GovRefusal; t: Translate; locale: Locale }) {
  return (
    <div aria-live="polite" style={{ minWidth: 0 }}>
      <Banner family="attention" code={refusal.code} density="portal" locale={locale}>
        {refusalSentence(refusal, null, t, locale)}
      </Banner>
    </div>
  );
}

/**
 * The mandate as recorded, read-only, under the banner its state calls for. SUBMITTED waits for the copyright
 * authority; a review that found the evidence short says why (the reviewing officer is never named); SUSPENDED says
 * from when collection and licensing stopped. APPROVED and EFFECTIVE carry no banner: the board draws none, and
 * the mandate is then simply what the organisation is recognised as representing.
 */
function ReadOnlyMandate({ mandate, data, phone, t, locale }: { mandate: Mandate; data: OurMandate; phone: boolean; t: Translate; locale: Locale }) {
  const { register } = data;
  const authority = register.authorities.find((entry) => entry.id === mandate.grantingAuthority);
  const evidence = mandate.evidence;
  const period =
    mandate.effectiveFrom === null
      ? null
      : mandate.effectiveTo === null
        ? t("gov14.periodOpen", { date: day(mandate.effectiveFrom, locale) })
        : t("gov14.periodTo", { from: day(mandate.effectiveFrom, locale), to: day(mandate.effectiveTo, locale) });
  const inset = phone ? "sm" : "md";
  return (
    <>
      {mandate.state === "SUSPENDED" && mandate.stoppedOn !== null ? (
        <Banner family="danger" title={t("gov14.susTitle", { date: day(mandate.stoppedOn, locale) })} density="portal" locale={locale}>
          {t("gov14.susText")}
        </Banner>
      ) : null}
      {mandate.state === "SUBMITTED" && mandate.review === null && mandate.submittedOn !== null ? (
        <Banner family="attention" title={t("gov14.subTitle", { date: day(mandate.submittedOn, locale) })} density="portal" locale={locale}>
          {t("gov14.subText")}
        </Banner>
      ) : null}
      {mandate.state === "SUBMITTED" && mandate.review !== null ? (
        <Banner family="attention" title={t("gov14.insTitle")} density="portal" locale={locale}>
          {localised(mandate.review.reason, locale)}
        </Banner>
      ) : null}
      <Columns layout="halves" single={phone}>
        <Panel title={t("gov14.basis")} level={2} inset={inset} gap="sm" density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("gov14.fGrantedBy"), value: authority !== undefined ? localised(authority.name, locale) : null },
              {
                label: t("gov14.fDocument"),
                value: evidence === null ? null : evidence.kind === "document" ? localised(evidence.title, locale) : evidence.file.name,
              },
              { label: t("gov14.fPeriod"), value: period },
            ]}
            locale={locale}
          />
        </Panel>
        <Panel title={t("gov14.rights")} level={2} meta={rowCount(mandate.scope.length, t, locale)} gap="sm" inset={inset} density="portal" locale={locale}>
          <ItemList items={scopeItems(mandate.scope, register, t)} density="portal" label={t("gov14.rights")} locale={locale} />
        </Panel>
      </Columns>
    </>
  );
}

import { Banner, Columns, EmptyState, FactList, PageHeader, Panel, Skeleton, StatusLine, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { ClaimOutcomeFields } from "@/features/registration/ClaimOutcomeFields";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { codeStatus, day, documentTitle, inLine, layerWords, moment, reasonWords, refusal, regOpsTranslator, reviewTypeWords } from "@/features/registration/console-copy";
import { recordClaimOutcome } from "@/features/registration/review-actions";
import { readForPage } from "@/lib/api/flash";
import { loadClaimReview, type ClaimOutcomeAttempt, type ClaimReviewView } from "@/lib/api/registration-review";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CLAIM_REASONS, REG12_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "claim-outcome";
const OUTCOMES = ["ACCEPTED", "PARTLY_ACCEPTED", "NOT_ACCEPTED"] as const;
/** The refusals said beside a field; any other is said in the page header. */
const FIELD_CODES: readonly string[] = ["OUTCOME_REASON_REQUIRED", "ACCEPTED_SCOPE_INVALID"];

/**
 * SCR-REG-12 Claim review. One non-use or direct-licence claim decided on its evidence: accepted, partly accepted
 * or not accepted, with the reason, and what the outcome does to the fee - and why it does not move the deadline.
 * An officer comes from the case file and goes back to it; the legal authority comes by a direct link and is
 * confirmed in place.
 */
export default async function ClaimReviewPage({ params, searchParams }: { params: Promise<{ application: string; claim: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-LGL");
  const [{ application, claim }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG12_VIEWS);
  const outcome = asked === "loading" ? null : await loadClaimReview(staff, application, claim, reviewViewOf("12", asked));
  const view = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const last = readForPage<ClaimOutcomeAttempt>(query);
  const attempt = last?.page === "claim" && last.application === application && last.claim === claim ? last : null;
  // The legal authority cannot read the queue or the case file, so neither is offered as a way back.
  const officer = holds(staff, "ACT-OPS");
  // A claim with its outcome recorded shows the outcome; one that ended without one (withdrawn) says why it cannot be decided.
  const headCode = attempt !== null && !FIELD_CODES.includes(attempt.code) ? attempt.code : view !== null && view.claim.outcome === null ? view.blocked : null;

  return (
    <OpsFrame console="operations" current="registration" staff={staff} searchLabel={t("regops.search")} keyMap={[{ keys: ["Esc"], label: t("regops.keyEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={
            officer
              ? [
                  { label: t("regops.area") },
                  { label: t("regops.queue"), href: routes.opsRegistration() },
                  { label: t("regops.caseFile", { r: application }), href: routes.opsApplication(application) },
                ]
              : [{ label: t("regops.area") }]
          }
          title={view !== null ? t("reg12.title", { r: view.reference }) : t("reg12.titleGeneric")}
          {...(view !== null ? { status: codeStatus(view.claim.state), meta: meta(view, t, locale) } : {})}
          locale={locale}
        />
        {headCode !== null && view !== null ? (
          <Banner family="attention" title={refusal(t, headCode, "reg12").title} code={headCode} density="console" live locale={locale}>
            {refusal(t, headCode, "reg12").text}
          </Banner>
        ) : null}
        {asked === "loading" ? <Loading /> : null}
        {failure !== null ? <ConsoleFailure failure={failure} screen="reg12" t={t} locale={locale} /> : null}
        {view !== null ? <Review view={view} attempt={attempt} officer={officer} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Loading() {
  return (
    <Columns layout="halves">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Panel>
          <Skeleton variant="facts" rows={5} density="console" />
        </Panel>
        <Panel>
          <Skeleton variant="table" rows={2} columns={3} density="console" />
        </Panel>
      </div>
      <Panel>
        <Skeleton variant="card" rows={6} density="console" />
      </Panel>
    </Columns>
  );
}

function meta(view: ClaimReviewView, t: Translate, locale: Locale): string {
  const type = reviewTypeWords(view.reviewType, t);
  if (view.decision !== null) return t("reg12.metaDecided", { p: view.premises.name, o: view.decision });
  return view.completeOn !== null
    ? t("reg12.meta", { p: view.premises.name, s: view.status, type, c: day(view.completeOn, locale) })
    : t("reg12.metaNoDate", { p: view.premises.name, s: view.status, type });
}

/** What each outcome does, as the effect panel and the confirmation say it (DR-289), the deadline sentence last. */
function effects(view: ClaimReviewView, t: Translate): Record<string, string[]> {
  const deadline = t("reg12.deadline");
  const layer = layerWords(view.claim.layer, t);
  if (view.decision !== null) {
    const accepted = [t("reg12.after", { o: view.decision }), t("reg12.superseded", { o: view.decision }), deadline];
    return { ACCEPTED: accepted, PARTLY_ACCEPTED: accepted, NOT_ACCEPTED: [t("reg12.afterNot", { o: view.decision }), deadline] };
  }
  const accepted = [t("reg12.before"), deadline];
  return { ACCEPTED: accepted, PARTLY_ACCEPTED: accepted, NOT_ACCEPTED: [t("reg12.beforeNot", { layer }), deadline] };
}

function Review({ view, attempt, officer, t, locale }: { view: ClaimReviewView; attempt: ClaimOutcomeAttempt | null; officer: boolean; t: Translate; locale: Locale }) {
  const claim = view.claim;
  const recorded = claim.outcome;
  const outcomeWords = (state: string) => t(`reg12.o.${state}`);
  return (
    <Columns layout="halves">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Panel title={t("reg12.claimTitle")} compact locale={locale}>
          <FactList
            items={[
              { label: t("reg12.kind"), value: t(`regops.claimKind.${claim.kind}`) },
              { label: t("reg12.layer"), value: layerWords(claim.layer, t) },
              { label: t("reg12.period"), value: claim.period, kind: "period" },
              { label: t("reg12.state"), value: codeStatus(claim.state), kind: "status" },
              { label: t("reg12.raisedBy"), value: t("regops.actor.PRINCIPAL") },
              ...(claim.raisedAt !== null ? [{ label: t("reg12.raisedOn"), value: claim.raisedAt.slice(0, 10), kind: "date" as const }] : []),
            ]}
            density="console"
            locale={locale}
          />
        </Panel>
        <Panel title={t("reg12.evTitle")} compact locale={locale}>
          {view.evidence.length > 0 ? (
            <Table
              columns={[
                { key: "doc", label: t("reg12.evDoc") },
                { key: "at", label: t("reg12.evAt"), kind: "date", nowrap: true },
                { key: "dig", label: t("reg12.evDigest"), kind: "mono", nowrap: true },
              ]}
              rows={view.evidence.map((entry) => ({ _key: entry.key, doc: documentTitle(entry.title, t), at: entry.receivedOn, dig: `…${entry.digest}` }))}
              density="console"
              caption={t("reg12.evTitle")}
              locale={locale}
            />
          ) : (
            <EmptyState variant="governed" title={t("reg12.noEvTitle")} density="console" locale={locale} />
          )}
        </Panel>
      </div>
      <div style={{ minWidth: 0 }}>
        {claim.state === "UNDER_REVIEW" ? (
          <form id={FORM} action={recordClaimOutcome.bind(null, view.reference, claim.id)} noValidate>
            <ClaimOutcomeFields
              formId={FORM}
              words={{
                outcome: t("reg12.outcome"),
                outcomes: OUTCOMES.map((value) => ({ value, label: outcomeWords(value) })),
                reason: t("reg12.reason"),
                reasonPick: t("reg12.reasonPick"),
                reasonHelp: t("reg12.reasonHelp"),
                reasons: CLAIM_REASONS.map((value) => ({ value, label: reasonWords(value, locale) })),
                scope: t("reg12.scope"),
                from: t("reg12.from"),
                to: t("reg12.to"),
                scopeHelp: t("reg12.scopeHelp", { a: day(claim.period.from, locale), b: day(claim.period.to, locale) }),
                coRecord: t("reg12.coRecord"),
                coHelp: view.legalReader ? t("reg12.coHelpLegal") : t("reg12.coHelpOfficer"),
                effect: t("reg12.effect"),
                effects: effects(view, t),
                record: t("reg12.record"),
                recordWhy: t("reg12.recordWhy"),
                cancel: t("regops.cancel"),
                dlgTitle: t("reg12.dlgTitle", { o: "{o}", p: view.premises.name, layer: inLine(layerWords(claim.layer, t), locale) }),
                dlgFinal: t("reg12.dlgFinal"),
                dlgBack: t("regops.back"),
              }}
              initial={
                attempt !== null
                  ? attempt.values
                  : { outcome: "", reason: "", scopeFrom: claim.period.from, scopeTo: claim.period.to, withLegal: false }
              }
              period={claim.period}
              legalReader={view.legalReader}
              reasonError={attempt?.code === "OUTCOME_REASON_REQUIRED" ? refusal(t, attempt.code).text : null}
              scopeError={attempt?.code === "ACCEPTED_SCOPE_INVALID" ? refusal(t, attempt.code).text : null}
              cancelHref={officer ? routes.opsApplication(view.reference) : null}
              locale={locale}
            />
          </form>
        ) : recorded !== null ? (
          <Panel title={t("reg12.recTitle")} compact locale={locale}>
            <StatusLine
              family="positive"
              text={t("reg12.recLine", { at: moment(recorded.recordedAt, locale) })}
              detail={recorded.legal !== null ? t("reg12.recDetailLegal", { who: recorded.legal }) : t("reg12.recDetail", { who: recorded.recordedBy })}
              cutout="surface"
              locale={locale}
            />
            <FactList
              items={[
                { label: t("reg12.outcome"), value: codeStatus(claim.state), kind: "status" },
                { label: t("reg12.reason"), value: reasonWords(recorded.reason, locale) },
                ...(recorded.scope !== null ? [{ label: t("reg12.scope"), value: recorded.scope, kind: "period" as const }] : []),
                ...(recorded.legal !== null ? [{ label: t("reg12.recWith"), value: recorded.legal }] : []),
              ]}
              density="console"
              locale={locale}
            />
            <Panel variant="plain" level={3} title={t("reg12.effect")} compact locale={locale}>
              {(effects(view, t)[claim.state] ?? []).map((line) => (
                <Text key={line} size="sm">
                  {line}
                </Text>
              ))}
            </Panel>
          </Panel>
        ) : null}
      </div>
    </Columns>
  );
}

import {
  Banner,
  Breakdown,
  Button,
  ButtonRow,
  Columns,
  Disclosure,
  FactList,
  Link,
  PageHeader,
  Panel,
  Skeleton,
  ViewState,
} from "@/components/r1";
import type { StatusValue } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { SubmitButton } from "@/features/registration/SubmitButton";
import { changeDecision, renewDecision } from "@/features/registration/actions";
import { day, moment, regTranslator, span } from "@/features/registration/copy";
import { loadDecision, loadDecisionSettled, type DecisionRecord } from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG08_VIEWS } from "@/lib/mock/registration";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import type { LoadOutcome } from "@rightone/ui";

type SearchParams = Record<string, string | string[] | undefined>;
type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;

/**
 * SCR-REG-08 Obligation decision. What the premises owes, for which period and by when, on what the
 * decision rests, and, when it was not decided as applied for, why and what the premises can do. It is the
 * decision on the fee, never the status record CER issues from it.
 */
export default async function DecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ decision: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipal();
  const [{ decision }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = regTranslator(locale);
  const view = reviewView(query, REG08_VIEWS);
  const outcome = view === "loading" ? null : await loadDecision(principal.sessionId, decision, view);
  const record = outcome?.data ?? null;
  const settled = record !== null && view === null ? await loadDecisionSettled(principal.sessionId, record.reference) : false;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("applications", frame, locale)}
      account={principal.account}
      {...(record !== null ? { context: { premises: record.premises, period: record.reference } } : {})}
      locale={locale}
    >
      <PageHeader
        crumbs={[{ label: t("reg.crumb"), href: routes.applications() }]}
        title={record !== null ? t("reg08.title", { ref: record.reference, premises: record.premises }) : t("reg08.titleGeneric")}
        {...(record !== null
          ? {
              status: decisionStatus(record, t),
              meta: t("reg08.meta", { ts: moment(record.issuedAt, locale), from: day(record.period.from, locale), to: day(record.period.to, locale) }),
            }
          : {})}
        locale={locale}
      />
      {view === "loading" ? <Loading frame={frame} locale={locale} /> : null}
      {failure !== null ? <Unavailable failure={failure} phone={phone} t={t} locale={locale} /> : null}
      {record !== null ? <Decision record={record} settled={settled} appealOpen={view === "appeal-open"} frame={frame} t={t} locale={locale} /> : null}
    </PortalShell>
  );
}

function Loading({ frame, locale }: { frame: Frame; locale: Locale }) {
  const inset = frame === "phone" ? "sm" : "md";
  return (
    <Columns single={frame !== "desktop"} gap={frame === "phone" ? 4 : 6}>
      <div style={{ display: "flex", flexDirection: "column", gap: frame === "phone" ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <Panel inset={inset} density="portal" locale={locale}>
          <Skeleton variant="card" rows={4} density="portal" locale={locale} />
        </Panel>
        <Panel inset={inset} density="portal" locale={locale}>
          <Skeleton variant="table" rows={4} columns={2} density="portal" locale={locale} />
        </Panel>
      </div>
      <Panel inset={inset} density="portal" locale={locale}>
        <Skeleton variant="facts" rows={4} density="portal" locale={locale} />
      </Panel>
    </Columns>
  );
}

/** A decision that is not found, or not the person's to see, is a refusal with its sentence; anything else is our outage. */
function Unavailable({ failure, phone, t, locale }: { failure: Failure; phone: boolean; t: Translate; locale: Locale }) {
  if (failure.code !== "DECISION_NOT_FOUND") {
    return (
      <ViewState
        view="error"
        errorTitle={t("reg.errTitle")}
        errorText={t("reg.errText")}
        {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
        retryable={failure.retryable}
        density="portal"
        locale={locale}
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: phone ? "stretch" : "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
      <ViewState
        view="refused"
        refusal={{ code: failure.code, title: t("reg08.nfTitle"), text: t("reg08.nfText"), family: "attention" }}
        density="portal"
        locale={locale}
      />
      <Button variant="secondary" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
        {t("reg08.back")}
      </Button>
    </div>
  );
}

function Decision({
  record,
  settled,
  appealOpen,
  frame,
  t,
  locale,
}: {
  record: DecisionRecord;
  /** FIN reconciled a payment of it: the fee is paid, so the page leads to the payment rather than to paying. */
  settled: boolean;
  appealOpen: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const current = record.status === "CURRENT";
  // A decision with a fee still to pay leads to its payment, the demo's way on to SCR-FIN-01.
  const payable = current && record.outcome === "PAYABLE" && record.payBy !== null && !settled;
  const otherwise = record.otherwise;

  return (
    <>
      {record.replacedBy !== null ? (
        <Banner
          family="info"
          title={t("reg08.chainTitle", { ref: record.replacedBy.reference, d: day(record.replacedBy.from, locale) })}
          action={{ label: t("reg08.chainOpen", { ref: record.replacedBy.reference }), href: routes.decision(record.replacedBy.reference), variant: "secondary" }}
          density="portal"
          locale={locale}
        >
          {t("reg08.chainText", { ref: record.replacedBy.reference })}
        </Banner>
      ) : null}
      <Columns single={frame !== "desktop"} gap={frame === "phone" ? 4 : 6}>
        <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
          {/* Not as applied for: the statement comes first, whether an officer or a rule decided it. */}
          {/* A claim not accepted after the decision: the statement DR-289 row 6 writes, with the appeal route. */}
          {record.claim?.state === "NOT_ACCEPTED" ? <ClaimNotAccepted record={record} claim={record.claim} open={appealOpen} inset={inset} t={t} locale={locale} /> : null}
          {otherwise !== null ? (
            <Panel title={t(`reg08.otherwise.${otherwise.aspect}`)} inset={inset} density="portal" locale={locale}>
              <Text size="base" measure="xl">
                {otherwise.reason[locale]}
              </Text>
              <FactList
                items={[
                  { label: t("reg08.notMet"), value: otherwise.notMet[locale] },
                  { label: t("reg08.youCan"), value: otherwise.youCan[locale] },
                ]}
                density="portal"
                locale={locale}
              />
              <Panel variant="plain" level={3} title={t("reg08.appeal")} density="portal" locale={locale}>
                <AppealRoute record={record} open={appealOpen} level={4} t={t} locale={locale} />
              </Panel>
            </Panel>
          ) : null}

          <Panel inset={inset} density="portal" locale={locale}>
            <Breakdown
              title={t("reg08.fee")}
              description={t(`reg08.basis.${record.basis}`)}
              lines={feeLines(record, t, locale)}
              currency={record.currency}
              locale={locale}
            />
            {record.payBy !== null && record.useBeganOn !== null ? (
              <Text size="base" measure="xl">
                {t(record.claim?.state === "UNDER_REVIEW" ? "reg08.payByClaim" : "reg08.payBy", {
                  d: day(record.payBy, locale),
                  u: day(record.useBeganOn, locale),
                })}
              </Text>
            ) : null}
            {/* SCR-TAR-14 How your fee was calculated: TAR draws it, REG-08 holds the way in (TAR finding F-4). */}
            <div>
              <Link href={routes.feeCalculation(record.reference)} variant="standalone" size="touch" locale={locale}>
                {t("reg08.feeHow")}
              </Link>
            </div>
          </Panel>

          {/* As applied for: the appeal route alone, under If you disagree (FR-REG-038). */}
          {otherwise === null ? (
            <Panel title={t("reg08.disagree")} inset={inset} density="portal" locale={locale}>
              <AppealRoute record={record} open={appealOpen} level={3} t={t} locale={locale} />
            </Panel>
          ) : null}
        </div>

        <Panel as="aside" title={t("reg08.restsOn")} inset={inset} density="portal" locale={locale}>
          <FactList items={restsOn(record, t, locale)} density="portal" locale={locale} />
          {record.application !== null ? (
            <div>
              <Link href={routes.application(record.application)} variant="standalone" size="touch" locale={locale}>
                {t("reg08.openApp")}
              </Link>
            </div>
          ) : null}
        </Panel>
      </Columns>

      <Text size="base" measure="2xl">
        {t("reg08.recordLine")}
      </Text>
      <ButtonRow>
        {payable ? (
          <Button variant="primary" size="md" href={routes.pay(record.reference)} fullWidth={phone} locale={locale}>
            {t("reg08.pay")}
          </Button>
        ) : null}
        {settled ? (
          <Button variant="secondary" size="md" href={routes.paymentPosition(record.reference)} fullWidth={phone} locale={locale}>
            {t("reg08.paid")}
          </Button>
        ) : null}
        {/* Each opens SCR-REG-02 as a change or a renewal of this decision. */}
        {current ? (
          <>
            <form action={changeDecision.bind(null, record.reference)}>
              <SubmitButton variant="secondary" size="md" fullWidth={phone} locale={locale}>
                {t("reg08.change")}
              </SubmitButton>
            </form>
            <form action={renewDecision.bind(null, record.reference)}>
              <SubmitButton variant="secondary" size="md" fullWidth={phone} locale={locale}>
                {t("reg08.renew")}
              </SubmitButton>
            </form>
          </>
        ) : null}
        <Button variant="quiet" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
          {t("reg08.back")}
        </Button>
      </ButtonRow>
    </>
  );
}

type NotAccepted = Extract<NonNullable<DecisionRecord["claim"]>, { state: "NOT_ACCEPTED" }>;

/** A rights layer inside a sentence: lower case in Vietnamese ("không sử dụng quyền tác giả"), as written in English. */
const layerInLine = (layer: NotAccepted["layer"], t: Translate, locale: Locale) => {
  const words = t(`reg.layer.${layer}`);
  return locale === "vi" ? words.charAt(0).toLowerCase() + words.slice(1) : words;
};

/** The statement of a claim not accepted after the decision: why, the condition not shown, what the premises can do, how to appeal. */
function ClaimNotAccepted({ record, claim, open, inset, t, locale }: { record: DecisionRecord; claim: NotAccepted; open: boolean; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const values = { layer: layerInLine(claim.layer, t, locale), p: span(claim.period, locale) };
  return (
    <Panel title={t("reg08.notAccepted.title")} inset={inset} density="portal" locale={locale}>
      <Text size="base" measure="xl">
        {t("reg08.notAccepted.text", values)}
      </Text>
      <FactList
        items={[
          { label: t("reg08.notAccepted.reason"), value: claim.reason[locale] },
          { label: t("reg08.notMet"), value: t(`reg08.notAccepted.cond.${claim.kind}`, values) },
          { label: t("reg08.youCan"), value: t("reg08.notAccepted.youCan") },
        ]}
        density="portal"
        locale={locale}
      />
      <Panel variant="plain" level={3} title={t("reg08.appeal")} density="portal" locale={locale}>
        <AppealRoute record={record} open={open} level={4} t={t} locale={locale} />
      </Panel>
    </Panel>
  );
}

/** How to appeal, the route the explanation the person confirmed against gives. */
function AppealRoute({ record, open, level, t, locale }: { record: DecisionRecord; open: boolean; level: 3 | 4; t: Translate; locale: Locale }) {
  return (
    <Disclosure title={t("reg08.howAppeal")} {...(open ? { open: true } : {})} level={level} density="portal" locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxWidth: "var(--container-xl)" }}>
        {(["reg08.route1", "reg08.route2", "reg08.route3"] as const).map((key) => (
          <Text key={key} size="base">
            {t(key)}
          </Text>
        ))}
        {/* SCR-CAS-01 with this decision as the affected record, so the appeal starts where route2 says. */}
        <div>
          <Link href={routes.raiseCase(record.reference)} variant="standalone" size="touch" locale={locale}>
            {t("reg08.appealStart")}
          </Link>
        </div>
        <Text size="sm" tone="secondary">
          {t("reg08.routeSource", { n: record.explanationVersion })}
        </Text>
      </div>
    </Disclosure>
  );
}

function decisionStatus(record: DecisionRecord, t: Translate): StatusValue {
  if (record.status === "SUPERSEDED") return { family: "info", label: t("reg.decision.SUPERSEDED") };
  return record.outcome === "NO_PAYABLE_OBLIGATION"
    ? { family: "positive", label: t("reg.decision.NO_PAYABLE_OBLIGATION") }
    : { family: "neutral", label: t("reg.decision.PAYABLE") };
}

/**
 * One line per rights layer, each with its tariff source, then the total. A no-fee decision draws the same
 * lines, each exempt (FR-REG-018); a split layer names the part of the period each line covers.
 */
function feeLines(record: DecisionRecord, t: Translate, locale: Locale) {
  const source = t("reg08.tariffSource", { version: record.tariffVersion });
  const treatment = (value: DecisionRecord["lines"][number]["treatment"]) =>
    value === "CLAIM_PENDING" ? t("reg.pending") : value !== null ? t(`reg08.treatment.${value}`) : null;
  const total = record.lines.reduce((sum, line) => sum + line.amountMinor, 0);
  return [
    ...record.lines.map((line) => {
      const detail = treatment(line.treatment);
      return {
        label: t(`reg.layer.${line.layer}`),
        ...(line.scope !== null ? { basis: span(line.scope, locale) } : {}),
        ...(detail !== null ? { detail } : {}),
        source,
        amountMinor: line.amountMinor,
      };
    }),
    { label: t("reg.total"), kind: "total" as const, amountMinor: total },
  ];
}

/** One line for each thing the decision rests on, only where it applies. */
function restsOn(record: DecisionRecord, t: Translate, locale: Locale) {
  const before = record.beforeRegistration;
  const claim = record.claim;
  return [
    { label: t("reg08.confirmed"), value: record.confirmedAt, kind: "datetime" as const },
    { label: t("reg08.explanation"), value: t("reg08.explanationVersion", { n: record.explanationVersion }) },
    { label: t("reg08.rules"), value: t("reg08.rulesVersion", { version: record.rulebookVersion }) },
    ...(before !== null
      ? [
          {
            label: t("reg08.before"),
            value: before,
            kind: typeof before === "string" ? ("date" as const) : ("period" as const),
            // DR-22: inside the amnesty nothing is owed for that time, and the amnesty version is named; otherwise row 3.
            note:
              record.preRegistration?.treatment === "AMNESTY_APPLIED" && record.preRegistration.amnesty !== null
                ? t("reg08.amnesty", { version: record.preRegistration.amnesty.version })
                : t("reg08.dec13"),
          },
        ]
      : []),
    // FR-TAR-012: a fee resting on the premises class the applicant declared says so on its face.
    ...(record.declaredClassification === true ? [{ label: t("reg08.declaredClass"), value: t("reg08.declaredClassValue") }] : []),
    ...(claim !== null
      ? [
          {
            label: t("reg08.claim"),
            value: t(`reg08.claimValue.${claim.state}`),
            note:
              claim.state === "PARTLY_ACCEPTED"
                ? t("reg08.claimNote.PARTLY_ACCEPTED", { p: span(claim.accepted, locale) })
                : claim.state === "NOT_ACCEPTED"
                  ? t("reg08.claimNote.NOT_ACCEPTED", { d: day(claim.on, locale) })
                  : t("reg08.claimNote.UNDER_REVIEW"),
          },
        ]
      : []),
    // DR-23 at the moment of reading; a decision with no fee still has the date (FR-REG-022, FR-REG-023).
    ...(record.deadline !== null ? [{ label: t("reg08.deadline"), value: record.deadline.on, kind: "date" as const, note: t(`reg08.deadline.${record.deadline.state}`) }] : []),
    ...(record.lateStatement !== null
      ? [{ label: t("reg08.late"), value: record.lateStatement.expectedOn, kind: "date" as const, note: t("reg08.lateNote", { d: day(record.lateStatement.deadline, locale) }) }]
      : []),
    ...(record.prior !== null ? [{ label: t("reg08.prior"), value: record.prior, kind: "id" as const }] : []),
  ];
}

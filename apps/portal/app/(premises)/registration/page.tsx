import { Banner, Button, EmptyState, PageHeader, Panel, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { ALL_PREMISES, PremisesFilter } from "@/features/registration/PremisesFilter";
import { applicationStatus, day, money, moment, regTranslator } from "@/features/registration/copy";
import {
  loadApplications,
  loadDecisions,
  loadPremisesActedFor,
  type ApplicationList,
  type ApplicationSummary,
  type DecisionList,
  type DecisionSummary,
} from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG01_VIEWS } from "@/lib/mock/registration";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import type { LoadOutcome } from "@rightone/ui";

type SearchParams = Record<string, string | string[] | undefined>;
type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;

/**
 * SCR-REG-01 My applications and decisions. Every application and decision of the premises the person may
 * act for, with the state of each and what happens next. The two lists are read separately, so one can
 * fail while the other shows; neither ever stands in for the other's failure.
 */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = regTranslator(locale);
  // The session's own lists; a reviewer's ?view= shows a state the canvas drew instead.
  const view = reviewView(params, REG01_VIEWS);
  const premisesId = typeof params.premises === "string" ? params.premises : null;
  const loading = view === "loading";
  const [premises, applications, decisions] =
    view === "loading"
      ? [null, null, null]
      : await Promise.all([
          loadPremisesActedFor(principal.sessionId, view),
          loadApplications(principal.sessionId, view, premisesId),
          loadDecisions(principal.sessionId, view, premisesId),
        ]);
  const phone = frame === "phone";

  const appsFailure = applications?.failure ?? null;
  const bothFailed = appsFailure !== null && (decisions?.failure ?? null) !== null;
  const empty = applications?.data?.items.length === 0 && decisions?.data?.items.length === 0 && premisesId === null;
  const showLists = !bothFailed && !empty;
  const actedFor = premises?.data ?? [];

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("applications", frame, locale)}
      account={principal.account}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("reg01.title")} meta={t("reg01.meta", { party: principal.party })} locale={locale}>
          {!empty ? (
            <Button variant="primary" size="md" icon="plus" href={routes.startApplication()} fullWidth={phone} locale={locale}>
              {t("reg01.start")}
            </Button>
          ) : null}
        </PageHeader>

        {/* The filter appears only for a person who acts for more than one premises. */}
        {showLists && !loading && actedFor.length > 1 ? (
          <div style={{ maxWidth: phone ? "100%" : "var(--container-md)" }}>
            <PremisesFilter
              label={t("reg01.filter")}
              options={[{ value: ALL_PREMISES, label: t("reg01.allPremises") }, ...actedFor.map((p) => ({ value: p.id, label: p.name }))]}
              value={premisesId ?? ALL_PREMISES}
              query={keptQuery(params)}
              locale={locale}
            />
          </div>
        ) : null}

        {bothFailed && appsFailure !== null ? <PageError failure={appsFailure} t={t} locale={locale} /> : null}

        {empty ? (
          <EmptyState
            variant="not-started"
            title={t("reg01.emptyTitle")}
            level={2}
            action={{ label: t("reg01.start"), href: routes.startApplication(), icon: "plus", variant: "primary" }}
            density="portal"
            locale={locale}
          >
            {t("reg01.emptyText")}
          </EmptyState>
        ) : null}

        {showLists ? (
          <>
            <Panel title={t("reg01.appsTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
              <Applications outcome={applications} filtered={premisesId !== null} frame={frame} t={t} locale={locale} />
            </Panel>
            <Panel title={t("reg01.decTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
              <Decisions outcome={decisions} filtered={premisesId !== null} frame={frame} t={t} locale={locale} />
            </Panel>
          </>
        ) : null}
      </div>
    </PortalShell>
  );
}

function PageError({ failure, t, locale }: { failure: Failure; t: Translate; locale: Locale }) {
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

function Applications({
  outcome,
  filtered,
  frame,
  t,
  locale,
}: {
  outcome: LoadOutcome<ApplicationList> | null;
  filtered: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  const tablet = frame === "tablet";
  const failure = outcome?.failure ?? null;
  if (failure !== null) {
    // The authority to act is read per row; without it no row can be shown, so the list gives way to the refusal.
    if (failure.code === "PREMISES_READ_UNAVAILABLE") {
      return (
        <Banner
          family="attention"
          title={t("reg.refusal.PREMISES_READ_UNAVAILABLE.title")}
          code={failure.code}
          action={{ label: t("reg01.retry"), icon: "refresh-cw", variant: "secondary", href: routes.applications() }}
          density="portal"
          locale={locale}
        >
          {t("reg.refusal.PREMISES_READ_UNAVAILABLE.text")}
        </Banner>
      );
    }
    return <PageError failure={failure} t={t} locale={locale} />;
  }
  const list = outcome?.data ?? null;
  return (
    <>
      <Table
        columns={[
          { key: "premises", label: t("reg01.cPremises"), kind: "text", ...(tablet ? {} : { minWidth: "var(--space-48)" }) },
          { key: "ref", label: t("reg01.cRef"), kind: "id", ...(tablet ? { priority: "low" as const } : {}) },
          { key: "kind", label: t("reg01.cKind"), kind: "text", ...(tablet ? { priority: "low" as const } : {}) },
          { key: "state", label: t("reg01.cState"), kind: "status", ...(tablet ? {} : { minWidth: "var(--space-48)" }) },
          { key: "next", label: t("reg01.cNext"), kind: "stack", ...(tablet ? {} : { minWidth: "var(--space-48)" }) },
        ]}
        rows={(list?.items ?? []).map((application) => applicationRow(application, phone, t, locale))}
        loading={list === null ? 5 : false}
        {...(filtered ? { empty: { variant: "filtered" } } : {})}
        density="portal"
        layout={phone ? "cards" : "table"}
        expandable={tablet}
        caption={t("reg01.appsTitle")}
        locale={locale}
      />
      {list?.moreRefused ? (
        <Banner
          family="attention"
          title={t("reg01.curTitle")}
          code={list.moreRefused}
          action={{ label: t("reg01.reload"), icon: "refresh-cw", variant: "secondary", href: routes.applications() }}
          density="portal"
          locale={locale}
        >
          {t("reg01.curText")}
        </Banner>
      ) : null}
      {list !== null && list.moreRefused === null ? <ShowMore more={list.hasMore} reason={t("reg01.allApps")} phone={phone} t={t} locale={locale} /> : null}
    </>
  );
}

function Decisions({
  outcome,
  filtered,
  frame,
  t,
  locale,
}: {
  outcome: LoadOutcome<DecisionList> | null;
  filtered: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  const tablet = frame === "tablet";
  const failure = outcome?.failure ?? null;
  if (failure !== null) {
    return (
      <EmptyState
        variant="error"
        title={t("reg01.decErr")}
        level={3}
        {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
        retryable={failure.retryable}
        density="portal"
        locale={locale}
      />
    );
  }
  const list = outcome?.data ?? null;
  return (
    <>
      <Table
        columns={[
          { key: "premises", label: t("reg01.cPremises"), kind: "text", ...(tablet ? {} : { minWidth: "var(--space-40)" }) },
          { key: "ref", label: t("reg01.cDecRef"), kind: "id", ...(tablet ? { priority: "low" as const } : {}) },
          { key: "state", label: t("reg01.cState"), kind: "status", ...(tablet ? {} : { minWidth: "var(--space-40)" }) },
          { key: "fee", label: t("reg01.cFee"), kind: "stack", align: "end", ...(tablet ? {} : { minWidth: "var(--space-40)" }) },
          { key: "period", label: t("reg01.cPeriod"), kind: "period", ...(tablet ? { priority: "low" as const } : {}) },
        ]}
        rows={(list?.items ?? []).map((decision) => decisionRow(decision, phone, t, locale))}
        loading={list === null ? 5 : false}
        {...(filtered ? { empty: { variant: "filtered" } } : {})}
        density="portal"
        layout={phone ? "cards" : "table"}
        expandable={tablet}
        caption={t("reg01.decTitle")}
        locale={locale}
      />
      {list !== null ? <ShowMore more={list.hasMore} reason={t("reg01.allDec")} phone={phone} t={t} locale={locale} /> : null}
    </>
  );
}

/** Show more, disabled with its reason once every row is shown; paging arrives with the API client. */
function ShowMore({ more, reason, phone, t, locale }: { more: boolean; reason: string; phone: boolean; t: Translate; locale: Locale }) {
  return (
    <div>
      <Button variant="secondary" size="md" disabled={!more} {...(!more ? { disabledReason: reason } : {})} fullWidth={phone} locale={locale}>
        {t("reg01.more")}
      </Button>
    </div>
  );
}

function applicationRow(application: ApplicationSummary, phone: boolean, t: Translate, locale: Locale): Record<string, unknown> {
  const status = applicationStatus(application.status, t);
  // A phone card puts the state beside its title, where a second line does not fit: the details move into the card.
  const stateDetail = application.startedByRightOne && !phone ? { detail: t("reg01.byRightOne") } : {};
  return {
    _key: application.reference,
    _href: routes.application(application.reference),
    premises: application.premises.name,
    ref: application.reference,
    kind: t(`reg.kind.${application.kind}`),
    state: { ...status, plain: true, ...stateDetail },
    next: nextStep(application, phone, t, locale),
  };
}

/** The Next column, worked out from the state as the specification lists it. */
function nextStep(application: ApplicationSummary, phone: boolean, t: Translate, locale: Locale): Record<string, unknown> | undefined {
  switch (application.status) {
    case "DRAFT": {
      const detail = application.startedByRightOne
        ? t(phone ? "reg01.byRightOneBoth" : "reg01.byRightOneNext")
        : application.savedAt !== null
          ? t("reg01.saved", { ts: moment(application.savedAt, locale) })
          : null;
      return { text: t("reg.next.continue"), href: routes.applicationFacts(application.reference), ...(detail !== null ? { detail } : {}) };
    }
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return {
        text: t("reg.next.deciding"),
        plain: true,
        ...(application.sentAt !== null ? { detail: t("reg01.sent", { ts: moment(application.sentAt, locale) }) } : {}),
      };
    case "EVIDENCE_REQUIRED":
      return application.evidence !== null
        ? {
            text: t("reg.next.sendBy", { d: day(application.evidence.dueOn, locale) }),
            plain: true,
            detail: t("reg01.asked", { d: day(application.evidence.askedOn, locale) }),
          }
        : undefined;
    case "DECIDED":
      return application.decision !== null ? { text: t("reg.next.read"), href: routes.decision(application.decision) } : undefined;
    // The three other endings: the status page says why it ended (convention 9).
    case "REFUSED":
    case "WITHDRAWN":
    case "CLOSED_INCOMPLETE":
      return { text: t("reg.next.ended"), href: routes.application(application.reference) };
  }
}

function decisionRow(decision: DecisionSummary, phone: boolean, t: Translate, locale: Locale): Record<string, unknown> {
  const replaced = decision.replacedBy !== null ? t("reg01.replacedBy", { ref: decision.replacedBy.reference, d: day(decision.replacedBy.from, locale) }) : null;
  const detail =
    decision.note === "OTHERWISE"
      ? t("reg01.otherwise")
      : decision.note === "CLAIM_PENDING"
        ? t("reg01.claimPending")
        : decision.note === "OUT_OF_SCOPE"
          ? t("reg01.outOfScope")
          : decision.replaces !== null
            ? t("reg01.replaces", { ref: decision.replaces })
            : replaced;
  const state =
    decision.status === "SUPERSEDED"
      ? { family: "info", label: t("reg.decision.SUPERSEDED") }
      : decision.outcome === "NO_PAYABLE_OBLIGATION"
        ? { family: "positive", label: t("reg.decision.NO_PAYABLE_OBLIGATION") }
        : { family: "neutral", label: t("reg.decision.PAYABLE") };
  const payable = decision.status === "CURRENT" && decision.outcome === "PAYABLE" && decision.payBy !== null;
  return {
    _key: decision.reference,
    _href: routes.decision(decision.reference),
    // On a phone the replacement is said under the card, where it has the width to read as a sentence.
    ...(phone && replaced !== null ? { _message: { severity: "info", text: replaced } } : {}),
    premises: decision.premises.name,
    ref: decision.reference,
    state: { ...state, plain: true, ...(detail !== null && !phone ? { detail } : {}) },
    fee: {
      text: money(decision.feeMinor, decision.currency, locale),
      plain: true,
      ...(payable && decision.payBy !== null ? { detail: t("reg01.payByLine", { d: day(decision.payBy, locale) }) } : {}),
    },
    period: decision.period,
  };
}

/** The query values a change of premises keeps: a reviewer's view and the frame. */
function keptQuery(params: SearchParams): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const key of ["view", "frame"]) {
    const value = params[key];
    if (typeof value === "string") kept[key] = value;
  }
  return kept;
}

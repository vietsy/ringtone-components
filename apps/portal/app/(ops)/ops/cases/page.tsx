import { redirect } from "next/navigation";
import { Banner, Button, PageHeader, Pagination, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, count, day, moment, one, opsStatus } from "@/features/cases/copy";
import { ANY, QueueFilter } from "@/features/cases/QueueFilter";
import { loadCaseQueue, type CaseQueue, type CaseState, type QueueFilter as Filter, type QueueRow } from "@/lib/api/cases";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAS03_VIEWS, CASE_TYPES } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The skeleton's rows while the page is read. */
const LOADING_ROWS = 8;

const STATES: readonly CaseState[] = [
  "RECEIVED",
  "TRIAGED",
  "ASSIGNED",
  "INVESTIGATING",
  "AWAITING_EVIDENCE",
  "SPECIALIST_ESCALATION",
  "DECISION_PENDING",
  "DECIDED",
  "REMEDY_IN_PROGRESS",
  "CLOSED",
  "CLOSED_INADMISSIBLE",
  "CLOSED_INCOMPLETE",
  "REFERRED",
  "WITHDRAWN",
];

/**
 * SCR-CAS-03 Case queue, the case workspace's landing. The cases in the officer's scope, the soonest due first, a
 * keyset page at a time, filtered by state, type and owner; a row opens the case. The workspace opens for the dispute
 * authority, the business approver, the security owner and the data protection officer too, and each lands where
 * their role works: the appeals and reopenings, the intake matrix they approve, or the protected categories' policies.
 * A support-line agent records a caller's case from here (SCR-CAS-01).
 */
export default async function CaseQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-CAS", "ACT-DSP", "ACT-BIZ-APR", "ACT-SEC", "ACT-DPO");
  if (!holds(staff, "ACT-CAS")) {
    redirect(holds(staff, "ACT-DSP") ? routes.opsCaseApprovals() : holds(staff, "ACT-BIZ-APR") ? routes.opsIntakeMatrix() : routes.opsCasePolicy("protected_category"));
  }
  const params = await searchParams;
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(params, CAS03_VIEWS);
  const state = STATES.find((candidate) => candidate === one(params.state)) ?? null;
  const chosen: Filter = { state, caseType: one(params.type), owner: one(params.owner) };
  const asked = view === "loading" ? null : await loadCaseQueue(staff, chosen, one(params.after), view);
  // A page token that no longer reads is said once, over the first page with the same filters.
  const lost = asked?.failure?.code === "CURSOR_INVALID";
  const outcome = lost ? await loadCaseQueue(staff, chosen, null, null) : asked;
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="cases"
      staff={staff}
      searchLabel={t("casops.search")}
      keyMap={[
        { keys: ["J", "K"], label: t("cas03.kMove") },
        { keys: ["Enter"], label: t("cas03.kOpen") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("casops.crumb") }]}
          title={t("cas03.title")}
          {...(data !== null ? { meta: t("cas03.meta", { t: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          {holds(staff, "ACT-SUP") ? (
            <Button variant="secondary" size="sm" icon="plus" href={routes.opsCallerCase()} locale={locale}>
              {t("cas03.caller")}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" href={routes.opsIntakeMatrix()} locale={locale}>
            {t("cas03.matrix")}
          </Button>
          <Button variant="secondary" size="sm" href={routes.opsCasePolicy()} locale={locale}>
            {t("cas03.policy")}
          </Button>
          {holds(staff, "ACT-DSP") ? (
            <Button variant="secondary" size="sm" href={routes.opsCaseApprovals()} locale={locale}>
              {t("cas03.approvals")}
            </Button>
          ) : null}
        </PageHeader>
        {lost || view === "page-lost" ? (
          <Banner family="attention" title={t("cas.refusal.CURSOR_INVALID.title")} code="CURSOR_INVALID" density="console" locale={locale}>
            {t("cas03.lostText")}
          </Banner>
        ) : null}
        {failure?.code === "ROLE_NOT_ASSIGNED" ? (
          <ViewState
            view="empty"
            empty={{ variant: "governed", title: t("cas03.noScopeTitle"), text: t("cas03.noScopeText"), action: false }}
            density="console"
            level={2}
            locale={locale}
          />
        ) : failure !== null && failure.code !== "CURSOR_INVALID" ? (
          <ConsoleFailure failure={failure} errorTitle={t("cas03.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
        ) : (
          <Queue data={data} chosen={chosen} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Queue({ data, chosen, t, locale }: { data: CaseQueue | null; chosen: Filter; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const filtered = chosen.state !== null || chosen.caseType !== null || chosen.owner !== null;
  const value = { state: chosen.state, type: chosen.caseType, owner: chosen.owner };
  return (
    <>
      <QueueFilter
        words={{ filters: t("cas03.filters"), state: t("cas03.fState"), type: t("cas03.fType"), owner: t("cas03.fOwner") }}
        states={[{ value: ANY, label: t("cas03.anyState") }, ...STATES.map((state) => ({ value: state, label: state }))]}
        types={[{ value: ANY, label: t("cas03.anyType") }, ...CASE_TYPES.map((type) => ({ value: type, label: t(`casops.caseType.${type}`) }))]}
        owners={[
          { value: ANY, label: t("cas03.anyOwner") },
          { value: "none", label: t("cas03.unassigned") },
          ...(data?.owners ?? []).map((owner) => ({ value: owner.email, label: owner.name })),
        ]}
        value={value}
        summary={data !== null ? t("cas03.count", { n: count(data.total, locale) }) : ""}
        locale={locale}
      />
      <Table
        columns={[
          { key: "ref", label: t("cas03.cRef"), kind: "id" },
          { key: "type", label: t("cas03.cType") },
          { key: "state", label: t("cas03.cState"), kind: "status" },
          { key: "raised", label: t("cas03.cRaised"), kind: "datetime" },
          { key: "due", label: t("cas03.cDue"), kind: "stack", detailSize: "sm", minWidth: "var(--space-32)", missing: t("cas03.noDue") },
          { key: "owner", label: t("cas03.cOwner") },
        ]}
        rows={rows.map((row) => queueRow(row, t, locale))}
        density="console"
        rowFocus
        {...(rows.length > 0 ? { sortNote: t("cas03.sortNote") } : {})}
        loading={data === null ? LOADING_ROWS : false}
        empty={
          filtered
            ? { variant: "filtered", title: t("cas03.emptyTitle"), text: t("cas03.emptyText"), action: false }
            : { variant: "not-started", title: t("cas03.noneTitle"), text: t("cas03.noneText"), action: false }
        }
        caption={t("cas03.title")}
        locale={locale}
      />
      {data !== null && rows.length > 0 ? (
        <Pagination
          summary={t("cas03.pager", { shown: count(data.offset + rows.length, locale), n: count(data.total, locale) })}
          hasNext={data.nextCursor !== null}
          {...(data.nextCursor !== null ? { nextHref: routes.opsCases({ ...value, after: data.nextCursor }) } : {})}
          {...(data.offset > 0 ? { firstHref: routes.opsCases(value) } : {})}
          endNote={data.nextCursor === null ? t(filtered ? "cas03.endFiltered" : "cas03.endAll") : false}
          density="console"
          label={t("cas03.pages")}
          locale={locale}
        />
      ) : null}
    </>
  );
}

/** One case: an overdue row says how long, in words and with the tint, never by colour alone. */
function queueRow(row: QueueRow, t: Translate, locale: Locale): Record<string, unknown> {
  const due = row.due !== null ? day(row.due, locale) : null;
  const detail = row.overdueDays !== null ? t("cas03.overdue", { n: count(row.overdueDays, locale) }) : row.caseType === null && due !== null ? t("cas03.dueClassify") : null;
  return {
    _key: row.reference,
    _href: routes.opsCase(row.reference),
    ...(row.overdueDays !== null ? { _tone: "attention" } : {}),
    ref: row.reference,
    type: row.caseType !== null ? t(`casops.caseType.${row.caseType}`) : t("cas03.unclassified"),
    state: { ...opsStatus(row.state), quiet: true },
    raised: row.submittedAt,
    due: due !== null ? { text: due, ...(detail !== null ? { detail } : {}) } : null,
    owner: row.owner?.name ?? t("cas03.unassigned"),
  };
}

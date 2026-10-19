import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, EmptyState, PageHeader, Select, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { CerTabs, ConsoleFailure } from "@/features/status-records/console";
import { ListFilter } from "@/features/status-records/ListFilter";
import { date, reviewStatus, stamp, timestamp } from "@/features/status-records/words";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { loadReviews, type ReviewFilter, type ReviewRow } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER04_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const FILTERS: readonly ReviewFilter[] = ["OPEN_PROPOSED", "OPEN", "PROPOSED", "APPROVED", "SUPERSEDED", "ALL"];

/**
 * SCR-CER-04 Status reviews. The questions about a record's status, the longest open first: those a payment or a
 * case event opened that wait for a proposal, and those proposed that wait for an approver. The officer proposes on
 * an open review, the approver decides a proposed one; the record's reference opens the record.
 */
export default async function StatusReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The officer, the approver and the auditor read here.
  const staff = await requireStaff("ACT-OPS", "ACT-BIZ-APR", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, CER04_VIEWS);
  const filter = FILTERS.find((entry) => entry === params.state) ?? "OPEN_PROPOSED";
  const outcome = view === "loading" ? null : await loadReviews(staff.sessionId, filter, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const rows = data?.rows ?? [];
  const actions = holds(staff, "ACT-OPS", "ACT-BIZ-APR");

  return (
    <OpsFrame
      console="operations"
      current="records"
      staff={staff}
      searchLabel={t("cer.search")}
      keyMap={[
        { keys: ["↑", "↓"], label: t("cer04.kMove") },
        { keys: ["Enter"], label: t("cer04.kOpen") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cer04.crumb"), href: routes.opsStatusRecords() }]}
          title={t("cer04.title")}
          {...(data !== null ? { meta: t("cer04.meta", { ts: timestamp(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        <CerTabs current="reviews" counts={data?.counts ?? null} t={t} locale={locale} />
        <form method="get" action={routes.opsStatusReviews()} style={{ display: "contents" }}>
          <ListFilter
            chips={filter !== "OPEN_PROPOSED" ? [{ label: t("cer04.chipState", { s: t(`cer04.o.${filter}`) }), href: routes.opsStatusReviews() }] : []}
            clearHref={routes.opsStatusReviews()}
            summary={data !== null ? t(rows.length === 1 ? "cer04.countOne" : "cer04.count", { n: R1_FORMAT.formatCount(rows.length, locale) ?? String(rows.length) }) : null}
            label={t("cer04.filters")}
            locale={locale}
          >
            <Select
              label={t("cer04.fState")}
              name="state"
              options={FILTERS.map((entry) => ({ value: entry, label: t(`cer04.o.${entry}`) }))}
              value={filter}
              density="console"
              width="var(--space-64)"
              locale={locale}
            />
            <Button variant="primary" size="sm" type="submit" locale={locale}>
              {t("cer04.show")}
            </Button>
          </ListFilter>
        </form>
        {failure?.code === "CURSOR_INVALID" ? (
          <Banner
            family="attention"
            title={t("cer04.curTitle")}
            code={failure.code}
            action={{ label: t("cer04.startAgain"), icon: "refresh-cw", variant: "secondary", href: routes.opsStatusReviews() }}
            density="console"
            locale={locale}
          >
            {t("cer.refusal.CURSOR_INVALID")}
          </Banner>
        ) : failure !== null ? (
          <ConsoleFailure failure={failure} refusals={{}} back={null} t={t} locale={locale} />
        ) : data !== null && rows.length === 0 ? (
          filter === "OPEN_PROPOSED" ? (
            <EmptyState variant="governed" title={t("cer04.emptyTitle")} level={2} action={false} density="console" locale={locale}>
              {t("cer04.emptyText")}
            </EmptyState>
          ) : (
            <EmptyState variant="filtered" title={t("cer04.emptyFilteredTitle")} level={2} action={false} density="console" locale={locale}>
              {t("cer04.emptyFilteredText")}
            </EmptyState>
          )
        ) : (
          <Table
            columns={[
              { key: "rec", label: t("cer04.cRecord"), kind: "mono", nowrap: true, missing: t("cer04.notIssued") },
              { key: "prem", label: t("cer04.cPremises"), minWidth: "var(--space-36)" },
              { key: "review", label: t("cer04.cReview"), kind: "id" },
              { key: "raised", label: t("cer04.cRaised"), kind: "stack", minWidth: "var(--space-32)" },
              { key: "st", label: t("cer04.cState"), kind: "status" },
              { key: "age", label: t("cer04.cAge"), align: "end", num: true, nowrap: true, help: t("cer04.ageHelp"), missing: t("cer04.ageClosed") },
              { key: "act", label: t("cer04.cActions"), kind: "actions", nowrap: true, hidden: !actions },
            ]}
            rows={rows.map((row) => reviewRow(row, staff, data?.asOf ?? row.openedAt, t, locale))}
            density="console"
            rowFocus
            {...(rows.length > 0 ? { sortNote: t("cer04.sortNote") } : {})}
            loading={data === null ? 2 : false}
            caption={t("cer04.title")}
            locale={locale}
          />
        )}
        {view !== "loading" && failure?.code !== "CURSOR_INVALID" && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <Button variant="secondary" size="sm" icon="refresh-cw" href={routes.opsStatusReviews(filter === "OPEN_PROPOSED" ? undefined : filter)} locale={locale}>
              {t("cer04.reload")}
            </Button>
          </div>
        )}
      </div>
    </OpsFrame>
  );
}

/** The proposal under a row, in the board's words: none yet, waiting with its ground and effect, or decided. */
function proposalLine(row: ReviewRow, t: Translate, locale: Locale): string {
  const proposal = row.proposal;
  if (proposal === null) return t("cer04.pNone");
  const act = t(`cer.actLower.${proposal.act}`);
  if (row.approved !== null) return t("cer04.pApproved", { act, who: row.approved.by, d: date(row.approved.at, locale) });
  const who = proposal.proposer.name;
  const at = stamp(proposal.proposer.at, locale);
  if (proposal.ground !== null) {
    const ground = t(`cer.ground.${proposal.ground}`);
    return proposal.effectiveAt !== null
      ? t("cer04.pAct", { act, ground, eff: timestamp(proposal.effectiveAt, locale), who, at })
      : t("cer04.pActNow", { act, ground, who, at });
  }
  return proposal.effectiveAt !== null ? t("cer04.pActPlain", { act, eff: timestamp(proposal.effectiveAt, locale), who, at }) : t("cer04.pActPlainNow", { act, who, at });
}

/** How long a review has been open: hours under a day, then days; a closed review says so. */
function age(row: ReviewRow, asOf: string, t: Translate, locale: Locale): string | null {
  if (row.closedAt !== null) return null;
  const hours = Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(row.openedAt)) / 3_600_000));
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);
  return hours < 24 ? t("cer04.hours", { n: count(hours) }) : t("cer04.days", { n: count(Math.floor(hours / 24)) });
}

function reviewRow(row: ReviewRow, staff: Staff, asOf: string, t: Translate, locale: Locale): Record<string, unknown> {
  const raised =
    row.trigger.kind === "PAYMENT_REVERSAL"
      ? { text: t("cer04.rReversal"), detail: t("cer04.rReversalDetail", { e: row.trigger.event }) }
      : row.trigger.kind === "CASE"
        ? { text: t("cer04.rCase"), detail: row.trigger.letter !== null ? t("cer04.rLetter", { c: row.trigger.caseRef, l: row.trigger.letter }) : row.trigger.caseRef }
        : { text: t("cer04.rOfficer"), detail: t("cer04.rOfficerDetail") };
  // The officer proposes on an open review, the approver decides a proposed one; each button is named for its review.
  const act =
    holds(staff, "ACT-OPS") && row.state === "OPEN"
      ? [{ label: t("cer04.propose"), ariaLabel: `${t("cer04.propose")} ${row.reference}`, variant: "quiet", href: routes.opsStatusRecordProposal(row.record.key, row.reference) }]
      : holds(staff, "ACT-BIZ-APR") && row.state === "PROPOSED"
        ? [{ label: t("cer04.decide"), ariaLabel: `${t("cer04.decide")} ${row.reference}`, variant: "quiet", href: routes.opsStatusReview(row.reference) }]
        : [];
  const shownAge = age(row, asOf, t, locale);
  return {
    _key: row.reference,
    // The record's reference in the first cell opens the record, as Enter does.
    _href: routes.opsStatusRecord(row.record.key),
    _message: { severity: "neutral", text: proposalLine(row, t, locale) },
    rec: row.record.reference ?? { missing: t("cer04.notIssued") },
    prem: row.premises,
    review: row.reference,
    raised,
    st: reviewStatus(t, row.state),
    ...(shownAge !== null ? { age: shownAge } : {}),
    act,
  };
}

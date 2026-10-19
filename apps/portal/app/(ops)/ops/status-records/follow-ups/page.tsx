import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, PageHeader, Pagination, Select, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { CerTabs, ConsoleFailure } from "@/features/status-records/console";
import { ListFilter } from "@/features/status-records/ListFilter";
import { columnTime, duration, followUpStatus, stamp, timestamp } from "@/features/status-records/words";
import { holds, requireStaff } from "@/lib/api/session";
import { loadFollowUps, type FollowUpFilter, type FollowUpRow } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER07_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const FILTERS: readonly FollowUpFilter[] = ["ALL", "OPEN", "OVERDUE", "APPLIED", "SUPERSEDED"];

/**
 * SCR-CER-07 Re-decided obligations. When a premises' obligation is decided again, its status record has to follow
 * the new decision by the time that decision takes effect; each follow-up with its due time, overdue first, the
 * outcome the rule gives or the one recorded. The officer resolves an open or overdue one; the legal authority and
 * the auditor read.
 */
export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The officer, the legal authority and the auditor read here.
  const staff = await requireStaff("ACT-OPS", "ACT-LGL", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, CER07_VIEWS);
  const filter = FILTERS.find((entry) => entry === params.state) ?? "ALL";
  const outcome = view === "loading" ? null : await loadFollowUps(staff.sessionId, filter, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const rows = data?.rows ?? [];
  const officer = holds(staff, "ACT-OPS");
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);

  return (
    <OpsFrame
      console="operations"
      current="records"
      staff={staff}
      searchLabel={t("cer.search")}
      keyMap={[
        { keys: ["↑", "↓"], label: t("cer07.kMove") },
        { keys: ["Enter"], label: t("cer07.kOpen") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cer07.crumb"), href: routes.opsStatusRecords() }]}
          title={t("cer07.title")}
          {...(data !== null ? { meta: t("cer07.meta", { ts: timestamp(data.asOf, locale) }) + (officer ? "" : t("cer07.metaRead")) } : {})}
          locale={locale}
        />
        <CerTabs current="followUps" counts={data?.counts ?? null} t={t} locale={locale} />
        <form method="get" action={routes.opsFollowUps()} style={{ display: "contents" }}>
          <ListFilter
            chips={filter !== "ALL" ? [{ label: t("cer07.chipState", { s: t(`cer.followUp.${filter}`) }), href: routes.opsFollowUps() }] : []}
            clearHref={routes.opsFollowUps()}
            summary={data !== null && failure === null ? t(rows.length === 1 ? "cer07.countOne" : "cer07.count", { n: count(rows.length) }) : null}
            label={t("cer07.filters")}
            locale={locale}
          >
            <Select
              label={t("cer07.fState")}
              name="state"
              options={FILTERS.map((entry) => ({ value: entry, label: entry === "ALL" ? t("cer07.allStates") : t(`cer.followUp.${entry}`) }))}
              value={filter}
              density="console"
              width="var(--space-56)"
              locale={locale}
            />
            <Button variant="primary" size="sm" type="submit" locale={locale}>
              {t("cer07.show")}
            </Button>
          </ListFilter>
        </form>
        {failure?.code === "CURSOR_INVALID" ? (
          <Banner
            family="attention"
            title={t("cer07.curTitle")}
            code={failure.code}
            action={{ label: t("cer07.startAgain"), icon: "refresh-cw", variant: "secondary", href: routes.opsFollowUps() }}
            density="console"
            locale={locale}
          >
            {t("cer.refusal.CURSOR_INVALID")}
          </Banner>
        ) : failure !== null ? (
          <ConsoleFailure
            failure={failure}
            refusals={{ DECISION_READ_UNAVAILABLE: { title: "cer07.duTitle", text: "cer.refusal.DECISION_READ_UNAVAILABLE", retry: routes.opsFollowUps() } }}
            back={null}
            t={t}
            locale={locale}
          />
        ) : (
          <>
            <Table
              columns={[
                { key: "id", label: t("cer07.cFollow"), kind: "id" },
                { key: "premises", label: t("cer07.cPremises"), kind: "stack", minWidth: "var(--space-44)" },
                { key: "due", label: t("cer07.cDue"), kind: "stack", unit: "GMT+7", nowrap: true },
                { key: "st", label: t("cer07.cState"), kind: "status", minWidth: "var(--space-36)" },
                { key: "outcome", label: t("cer07.cOutcome"), nowrap: true },
                { key: "actions", kind: "actions", ...(officer ? { minWidth: "var(--space-48)" } : {}) },
              ]}
              rows={rows.map((row) => followUpRow(row, officer, data?.asOf ?? row.dueBy, t, locale))}
              density="console"
              rowFocus
              {...(rows.length > 0 ? { sortNote: t("cer07.sortNote") } : {})}
              loading={data === null ? 3 : false}
              empty={
                filter === "ALL"
                  ? { variant: "not-started", title: t("cer07.emptyTitle"), text: t("cer07.emptyText"), action: false }
                  : { variant: "filtered", title: t("cer07.emptyFilteredTitle"), text: t("cer07.emptyFilteredText"), action: false }
              }
              caption={t("cer07.title")}
              locale={locale}
            />
            {rows.length > 0 && (
              <Pagination
                summary={rows.length === 1 ? t("cer07.pagerOne") : t("cer07.pager", { n: count(rows.length) })}
                hasNext={false}
                endNote={filter === "ALL" ? t("cer07.endNote") : t("cer07.endFiltered")}
                density="console"
                label={t("cer07.pages")}
                locale={locale}
              />
            )}
            {data !== null && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="secondary" size="sm" icon="refresh-cw" href={routes.opsFollowUps(filter === "ALL" ? undefined : filter)} locale={locale}>
                  {t("cer07.reload")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </OpsFrame>
  );
}

/** One follow-up: its due time, how long overdue or when applied and how late, and the outcome. The holder is never on a console list. */
function followUpRow(row: FollowUpRow, officer: boolean, asOf: string, t: Translate, locale: Locale): Record<string, unknown> {
  const status = followUpStatus(t, row.state);
  return {
    _key: row.reference,
    _href: routes.opsStatusRecord(row.record.key),
    id: row.reference,
    premises: { text: row.premises.name, ...(row.premises.register !== null ? { detail: row.premises.register } : {}) },
    due: {
      text: columnTime(row.dueBy, locale),
      plain: true,
      ...(row.state === "OVERDUE" ? { detail: t("cer07.overdueBy", { d: duration(t, Date.parse(asOf) - Date.parse(row.dueBy), locale) }) } : {}),
    },
    st:
      row.state === "APPLIED" && row.appliedAt !== null
        ? {
            ...status,
            detail:
              row.lateMs !== null
                ? t("cer07.appliedLate", { ts: stamp(row.appliedAt, locale), d: duration(t, row.lateMs, locale) })
                : t("cer07.applied", { ts: stamp(row.appliedAt, locale) }),
          }
        : status,
    outcome: row.outcome === null ? { missing: t("cer07.noOutcome") } : t(row.state === "APPLIED" ? `cer.outcomeDone.${row.outcome}` : `cer.outcome.${row.outcome}`),
    actions: [
      ...(officer && (row.state === "OPEN" || row.state === "OVERDUE")
        ? [{ label: t("cer07.resolve"), ariaLabel: `${t("cer07.resolve")} ${row.reference}`, variant: "quiet", href: routes.opsFollowUp(row.reference) }]
        : []),
      { label: t("cer07.record"), ariaLabel: t("cer07.recordFor", { id: row.reference }), variant: "quiet", href: routes.opsStatusRecord(row.record.key) },
    ],
  };
}

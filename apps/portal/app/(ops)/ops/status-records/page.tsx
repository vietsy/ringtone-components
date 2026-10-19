import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, Checkbox, Combobox, PageHeader, Pagination, Select, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { CerTabs, ConsoleFailure } from "@/features/status-records/console";
import { ListFilter } from "@/features/status-records/ListFilter";
import { recordStatus, stamp, timestamp } from "@/features/status-records/words";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { loadConsoleRecords, RECORD_STATUSES, type ConsoleRecordList, type ConsoleRecordRow, type RecordFilter } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER01_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** The rows a page holds, and the skeleton draws while it is read (design/03, SCR-CER-01 Loading). */
const PAGE_ROWS = 25;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * The filter in the address (design/03 convention 8). With none, the list opens on the records waiting to issue or
 * renew; the form sends `filtered`, so an unticked Waiting only lists every record.
 */
function filterOf(params: SearchParams): RecordFilter {
  const status = text(params.status);
  const waiting = text(params.waiting);
  return {
    status: RECORD_STATUSES.find((entry) => entry === status) ?? null,
    premises: text(params.premises_id),
    waiting: waiting === "on" || (waiting === null && params.filtered !== "1"),
  };
}

/**
 * SCR-CER-01 Status records, the Status records workspace's landing. Every record, the latest status change first,
 * opening on those waiting to issue or renew: what waits for its fee, what waits for an approver. The approver
 * approves from a row; the officer and the auditor open a record's history.
 */
export default async function StatusRecordsConsolePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The operations officer, the business approver and the auditor read here; anyone else goes back to My work.
  const staff = await requireStaff("ACT-OPS", "ACT-BIZ-APR", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, CER01_VIEWS);
  const filter = filterOf(params);
  const outcome = view === "loading" ? null : await loadConsoleRecords(staff.sessionId, filter, text(params.cursor), view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const first = routes.opsStatusRecords({ status: filter.status, premises: filter.premises, waiting: filter.waiting });

  return (
    <OpsFrame
      console="operations"
      current="records"
      staff={staff}
      searchLabel={t("cer.search")}
      keyMap={[
        { keys: ["↑", "↓"], label: t("cer01.kMove") },
        { keys: ["Enter"], label: t("cer01.kOpen") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          title={t("cer01.title")}
          {...(data !== null ? { meta: t(filter.waiting ? "cer01.metaWaiting" : "cer01.metaAll", { ts: timestamp(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        <CerTabs current="records" counts={data?.counts ?? null} t={t} locale={locale} />
        <Filter criteria={filter} data={data} t={t} locale={locale} />
        {failure?.code === "CURSOR_INVALID" ? (
          <Banner
            family="attention"
            title={t("cer01.curTitle")}
            code={failure.code}
            action={{ label: t("cer01.startAgain"), icon: "refresh-cw", variant: "secondary", href: first }}
            density="console"
            locale={locale}
          >
            {t("cer.refusal.CURSOR_INVALID")}
          </Banner>
        ) : failure !== null ? (
          <ConsoleFailure failure={failure} refusals={{}} back={null} t={t} locale={locale} />
        ) : (
          <Records data={data} criteria={filter} staff={staff} t={t} locale={locale} />
        )}
        {failure?.code !== "CURSOR_INVALID" && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" size="sm" icon="refresh-cw" href={first} locale={locale}>
              {t("cer01.reload")}
            </Button>
          </div>
        )}
      </div>
    </OpsFrame>
  );
}

/**
 * The filter: a status, a premises and Waiting only, sent in the address as a plain form so a link keeps it. A
 * chip removed or the filters cleared open the list without them; cleared, the list shows every record.
 */
function Filter({ criteria, data, t, locale }: { criteria: RecordFilter; data: ConsoleRecordList | null; t: Translate; locale: Locale }) {
  const premises = data?.premisesOptions.find((option) => option.value === criteria.premises) ?? null;
  const chips = [
    ...(criteria.waiting ? [{ label: t("cer01.waitingOnly"), href: routes.opsStatusRecords({ ...criteria, waiting: false }) }] : []),
    ...(criteria.status !== null ? [{ label: t("cer01.chipStatus", { s: t(`cer.status.${criteria.status}`) }), href: routes.opsStatusRecords({ ...criteria, status: null }) }] : []),
    ...(premises !== null ? [{ label: t("cer01.chipPremises", { p: premises.label }), href: routes.opsStatusRecords({ ...criteria, premises: null }) }] : []),
  ];
  const total = data?.total ?? null;

  return (
    // A GET form: the filter is the page's address (design/03 convention 8).
    <form method="get" action={routes.opsStatusRecords()} style={{ display: "contents" }}>
      <input type="hidden" name="filtered" value="1" />
      <ListFilter
        chips={chips}
        clearHref={routes.opsStatusRecords({ waiting: false })}
        summary={total !== null ? t(total === 1 ? "cer01.countOne" : "cer01.count", { n: R1_FORMAT.formatCount(total, locale) ?? String(total) }) : null}
        label={t("cer01.filters")}
        locale={locale}
      >
        <Select
          label={t("cer01.fStatus")}
          name="status"
          options={[{ value: "", label: t("cer01.anyStatus") }, ...RECORD_STATUSES.map((status) => ({ value: status, label: t(`cer.status.${status}`) }))]}
          value={criteria.status ?? ""}
          density="console"
          width="var(--space-48)"
          locale={locale}
        />
        <Combobox
          wrap
          label={t("cer01.fPremises")}
          name="premises_id"
          options={(data?.premisesOptions ?? []).map((option) => ({ value: option.value, label: option.label, ...(option.detail !== null ? { detail: option.detail } : {}) }))}
          {...(criteria.premises !== null ? { value: criteria.premises } : {})}
          placeholder={t("cer01.anyPremises")}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
        <Checkbox label={t("cer01.waitingOnly")} name="waiting" value="on" checked={criteria.waiting} density="console" locale={locale} />
        <Button variant="primary" size="sm" type="submit" locale={locale}>
          {t("cer01.show")}
        </Button>
      </ListFilter>
    </form>
  );
}

function Records({ data, criteria, staff, t, locale }: { data: ConsoleRecordList | null; criteria: RecordFilter; staff: Staff; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const shown = rows.length;
  const from = (data?.offset ?? 0) + 1;
  const to = (data?.offset ?? 0) + shown;
  const total = data?.total ?? 0;
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);
  // Only the premises filter set: the list says the premises holds no record.
  const premisesOnly = criteria.premises !== null && criteria.status === null && !criteria.waiting;

  return (
    <>
      <Table
        columns={[
          { key: "ref", label: t("cer01.cRef"), kind: "id", missing: t("cer01.notIssued") },
          { key: "prem", label: t("cer01.cPrem"), kind: "stack", minWidth: "var(--space-36)" },
          { key: "st", label: t("cer01.cStatus"), kind: "status", minWidth: "var(--space-32)" },
          // The Waiting on cell truncates and shows its full wording on focus; it has more room when only waiting rows show.
          { key: "wait", label: t("cer01.cWait"), truncate: true, maxWidth: criteria.waiting ? "var(--container-xs)" : "var(--space-40)" },
          { key: "period", label: t("cer01.cPeriod"), kind: "period", short: true, hidden: true },
          { key: "act", kind: "actions", minWidth: "var(--space-36)" },
        ]}
        rows={rows.map((row) => recordRow(row, staff, t, locale))}
        density="console"
        rowFocus
        {...(shown > 0 ? { sortNote: t("cer01.sortNote") } : {})}
        loading={data === null ? PAGE_ROWS : false}
        empty={{
          variant: "filtered",
          title: t(premisesOnly ? "cer01.emptyPremisesTitle" : "cer01.emptyTitle"),
          text: t("cer01.emptyText"),
          action: false,
        }}
        caption={t("cer01.title")}
        locale={locale}
      />
      {shown > 0 && (
        <Pagination
          summary={total === 1 ? t("cer01.pagerOne") : t("cer01.pager", { from: count(from), to: count(to), n: count(total) })}
          hasPrev={false}
          hasNext={(data?.nextCursor !== undefined && data?.nextCursor !== null)}
          {...((data?.nextCursor !== undefined && data?.nextCursor !== null) ? { nextHref: routes.opsStatusRecords({ ...criteria, after: data.nextCursor }) } : {})}
          endNote={criteria.status === null && criteria.premises === null && !criteria.waiting ? t("cer01.endAll") : t("cer01.endFiltered")}
          density="console"
          label={t("cer01.pages")}
          locale={locale}
        />
      )}
    </>
  );
}

/** One record: its reference opens it; Approve for the approver where it waits for one; History for the officer and the auditor. */
function recordRow(row: ConsoleRecordRow, staff: Staff, t: Translate, locale: Locale): Record<string, unknown> {
  // Each button is named for its row: the reference, or the premises while the record has none yet.
  const who = row.reference ?? row.premises.name;
  const named = (label: string) => `${label} ${who}`;
  const wait =
    row.waitingOn === null
      ? { missing: t("cer01.noWait") }
      : row.waitingOn.kind === "condition"
        ? t(`cer.condition.${row.waitingOn.condition}`)
        : row.waitingOn.kind === "declined"
          ? t("cer01.wait.declined")
          : t(`cer01.wait.${row.waitingOn.reason}`);
  return {
    _key: row.key,
    _href: routes.opsStatusRecord(row.key),
    ref: row.reference ?? { missing: t("cer01.notIssued") },
    prem: { text: row.premises.name, ...(row.premises.register !== null ? { detail: row.premises.register } : {}) },
    st: { ...recordStatus(t, row.status), detail: t(row.status === "REPLACED" ? "cer01.sinceReplaced" : "cer01.since", { ts: stamp(row.since, locale) }) },
    ...(row.period !== null ? { period: row.period } : {}),
    wait,
    act: [
      { label: t("cer01.open"), ariaLabel: named(t("cer01.open")), variant: "quiet", href: routes.opsStatusRecord(row.key) },
      ...(holds(staff, "ACT-BIZ-APR") && row.awaitsApprover
        ? [{ label: t("cer01.approve"), ariaLabel: named(t("cer01.approve")), variant: "quiet", href: routes.opsStatusRecordApproval(row.key) }]
        : []),
      ...(holds(staff, "ACT-OPS", "ACT-AUD")
        ? [{ label: t("cer01.history"), ariaLabel: named(t("cer01.history")), variant: "quiet", href: routes.opsStatusRecordHistory(row.key) }]
        : []),
    ],
  };
}

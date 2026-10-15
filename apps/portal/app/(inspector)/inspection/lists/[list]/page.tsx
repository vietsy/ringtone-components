import type { ComponentProps } from "react";
import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, ButtonRow, FactList, PageHeader, Panel, Skeleton, Table } from "@/components/r1";
import { ConsoleFailure, ConsoleFrame } from "@/features/inspection/ConsoleFrame";
import { CopySelected, EntryList, EntrySelection } from "@/features/inspection/EntryList";
import { date, joined, refusalOf, timestamp } from "@/features/inspection/words";
import {
  loadListSupply,
  type EntryClass,
  type ListKind,
  type ListSupply,
  type RegisterRead,
  type SupplyEntry,
} from "@/lib/api/inspection";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER08_VIEWS } from "@/lib/mock/inspection";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type Facts = ComponentProps<typeof FactList>["items"];

const STATE_FAMILY = { REQUESTED: "info", READY: "positive", FAILED: "danger", DISPOSED: "neutral" } as const;
/** The classes each kind of list sorts its entries into, in the order the filter offers them. */
const CLASSES: Readonly<Record<ListKind, readonly EntryClass[]>> = {
  NO_CURRENT_RECORD: ["NO_RECORD_EVER", "DECIDED_AWAITING_RECORD", "RECORD_NOT_CURRENT"],
  NOT_CURRENT_WITH_DECISION: ["REPORTED_CHANGE_UNDECIDED", "CONSEQUENCE_NOT_EFFECTIVE"],
};
/** The rows the skeleton draws while the entries are read. */
const LOADING_ROWS = 6;

/**
 * SCR-VER-08 List supply and entries. The inspector reads one supply: the statement of what it names and what it
 * does not mean, the register it came from and its age, the counts per area, and the entries, a page at a time.
 * A supply that failed shows its cause in place of the entries; it is never an empty list.
 */
export default async function ListSupplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ list: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Signed in as an inspector, or sent to sign in.
  const inspector = await requireInspector();
  const [{ list }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, VER08_VIEWS);
  const outcome = view === "loading" ? null : await loadListSupply(inspector.sessionId, list, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const entriesShown = failure === null && (data === null || (data.refusal === null && data.state === "READY"));
  // The entries' keys are listed only while the table that binds them is on the page.
  const rowsShown = entriesShown && data?.entriesRefusal !== "CURSOR_INVALID";

  return (
    <ConsoleFrame account={inspector.account} keyMap={rowsShown ? [{ keys: ["J", "K"], label: t("ver08.kRows") }] : []} t={t} locale={locale}>
      {/* The entry in focus is held for the table and for Copy, which the page places apart. */}
      <EntrySelection initial={data?.selected ?? null}>
        <PageHeader
          crumbs={[{ label: t("console.crumb") }, { label: t("ver08.crumbLists"), href: routes.inspectionLists() }]}
          title={
            data !== null
              ? t("ver08.title", { ref: data.reference, kind: t(`console.listKind.${data.kind}`), areas: joined(t, data.areas) })
              : list
          }
          {...(data !== null
            ? {
                status: {
                  family: STATE_FAMILY[data.state],
                  label: t(`console.supplyState.${data.state}`),
                  ...(data.state === "REQUESTED" ? { working: true } : {}),
                },
              }
            : {})}
          locale={locale}
        />
        {failure !== null ? (
          <ConsoleFailure failure={failure} refusals={["SUPPLY_NOT_FOUND", "NOT_AUTHORISED"]} t={t} locale={locale} />
        ) : data === null ? (
          <>
            <Panel density="console" locale={locale}>
              <Skeleton variant="facts" rows={3} density="console" locale={locale} />
            </Panel>
            <Entries data={null} t={t} locale={locale} />
          </>
        ) : (
          <Supply data={data} t={t} locale={locale} />
        )}
        <ButtonRow>
          {entriesShown && <CopySelected label={t("ver08.copy")} waitingReason={t("ver08.copyWhy")} locale={locale} />}
          <Button variant="quiet" size="sm" icon="arrow-left" href={routes.inspectionLists()} locale={locale}>
            {t("ver08.back")}
          </Button>
        </ButtonRow>
      </EntrySelection>
    </ConsoleFrame>
  );
}

function Supply({ data, t, locale }: { data: ListSupply; t: Translate; locale: Locale }) {
  if (data.refusal !== null) {
    // A refusal about the reader's authority stands for the whole supply.
    return (
      <Banner family="attention" title={refusalOf(t, data.refusal).title} code={data.refusal} density="console" locale={locale}>
        {refusalOf(t, data.refusal).text}
      </Banner>
    );
  }
  const ready = data.state === "READY";
  const entriesRefusal = data.entriesRefusal !== null && data.entriesRefusal !== "CURSOR_INVALID" ? data.entriesRefusal : null;

  return (
    <>
      {/* What the list names and what it does not mean, above the entries and never collapsed (FR-VER-031). */}
      {ready && (
        <Banner family="neutral" density="console" locale={locale}>
          {t(`ver08.statement.${data.kind}`)}
        </Banner>
      )}
      <Panel density="console" locale={locale}>
        <FactList items={headerFacts(data, t, locale)} density="console" locale={locale} />
      </Panel>
      {data.state === "FAILED" && data.failure !== null && (
        <Banner family="attention" title={refusalOf(t, data.failure).title} code={data.failure} density="console" locale={locale}>
          {refusalOf(t, data.failure).text}
        </Banner>
      )}
      {entriesRefusal !== null && (
        <Banner family="neutral" title={refusalOf(t, entriesRefusal).title} code={entriesRefusal} density="console" locale={locale}>
          {refusalOf(t, entriesRefusal).text}
        </Banner>
      )}
      {data.counts !== null && (ready || data.state === "DISPOSED") && <Counts counts={data.counts} t={t} locale={locale} />}
      {ready && <Entries data={data} t={t} locale={locale} />}
    </>
  );
}

/** The header: when it was generated and how long ago, or requested; and the register it was read from. */
function headerFacts(data: ListSupply, t: Translate, locale: Locale): Facts {
  const facts: Facts = [];
  if (data.state === "REQUESTED" && data.requestedAt !== null) {
    facts.push({ label: t("ver08.requested"), value: data.requestedAt, kind: "datetime" });
  } else if (data.generatedAt !== null) {
    facts.push({
      label: t("ver08.generated"),
      value: t("ver08.age", { t: timestamp(data.generatedAt, locale), n: R1_FORMAT.formatCount(data.ageDays, locale) ?? String(data.ageDays) }),
    });
  }
  if (data.register !== null) {
    facts.push({ label: t("ver08.register"), value: registerLine(data.register, t, locale) });
    facts.push({
      label: t("ver08.registerVersion"),
      value: t("ver08.readAt", { v: data.register.version, t: timestamp(data.register.readAt, locale) }),
    });
  } else if (data.registerUnread) {
    facts.push({ label: t("ver08.register"), value: null, missing: t("ver08.notRead") });
  }
  return facts;
}

/** The register line of FR-VER-041, in the words of section 5c: route; reconciliation; scope. */
function registerLine(register: RegisterRead, t: Translate, locale: Locale): string {
  const reconciled =
    register.reconciledAt !== null
      ? t("ver08.reconciled", {
          t: timestamp(register.reconciledAt, locale),
          n: R1_FORMAT.formatCount(register.reconciledDaysAgo, locale) ?? String(register.reconciledDaysAgo),
        })
      : t("ver08.never");
  return t("ver08.registerLine", {
    route: t(`ver08.route.${register.route}`),
    reconciled,
    scope: t(`ver08.scope.${register.scope}`, { a: joined(t, register.limitedAreas) }),
  });
}

/** Every area, zero included, and how the premises in them were counted. */
function Counts({ counts, t, locale }: { counts: NonNullable<ListSupply["counts"]>; t: Translate; locale: Locale }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "var(--space-6)", alignItems: "start" }}>
      <Panel title={t("ver08.byArea")} level={2} density="console" locale={locale}>
        <Table
          columns={[
            { key: "area", label: t("ver08.cArea"), kind: "strong" },
            { key: "listed", label: t("ver08.cListed"), kind: "count" },
          ]}
          rows={counts.byArea.map((row) => ({ _key: row.area, area: row.area, listed: row.listed }))}
          density="console"
          caption={t("ver08.byArea")}
          locale={locale}
        />
      </Panel>
      <Panel title={t("ver08.howCounted")} level={2} density="console" locale={locale}>
        <FactList
          // A count the register read does not give is left out rather than drawn as nought.
          items={[
            { label: t("ver08.listed"), value: counts.listed },
            { label: t("ver08.current"), value: counts.current },
            { label: t("ver08.outScope"), value: counts.outOfScope },
            { label: t("ver08.indeterminate"), value: counts.indeterminate },
            { label: t("ver08.notOperating"), value: counts.notOperating },
          ].flatMap((item) => (item.value !== null ? [{ ...item, kind: "count" as const }] : []))}
          density="console"
          locale={locale}
        />
      </Panel>
    </div>
  );
}

/** The entries, grouped by area in the supply's order, then by premises. Null while they are read. */
function Entries({ data, t, locale }: { data: ListSupply | null; t: Translate; locale: Locale }) {
  const entries = data?.entries ?? [];
  const cursor = data?.entriesRefusal === "CURSOR_INVALID" ? data.entriesRefusal : null;
  const areas = data?.areas ?? [];
  const classes = data !== null ? CLASSES[data.kind] : [];
  const register = data?.register ?? null;

  return (
    <Panel title={t("ver08.entries")} level={2} density="console" locale={locale}>
      {cursor !== null ? (
        // A page that can no longer be read is said in place of the entries: it is not an empty list.
        <Banner family="attention" title={t("ver.cursorTitle")} code={cursor} density="console" locale={locale}>
          {t("ver.cursorText")}
        </Banner>
      ) : (
        <EntryList
          columns={[
            { key: "name", label: t("ver08.cPremises"), kind: "strong", minWidth: "var(--space-48)" },
            { key: "ref", label: t("ver08.cRef"), kind: "id" },
            { key: "addr", label: t("ver08.cAddress"), minWidth: "var(--space-40)" },
            { key: "cls", label: t("ver08.cClass"), kind: "stack", minWidth: "var(--space-44)" },
            { key: "last", label: t("ver08.cLast"), kind: "status" },
            { key: "since", label: t("ver08.cSince"), kind: "date", short: true },
            { key: "deadline", label: t("ver08.cDeadline"), minWidth: "var(--space-40)" },
          ]}
          entries={entries.map((entry) => ({ key: entry.reference, area: entry.area, cls: entry.class, cells: entryCells(entry, t, locale) }))}
          areas={areas}
          words={{
            filters: t("ver08.filters"),
            area: t("ver08.area2"),
            cls: t("ver08.cls"),
            areaOptions: [{ value: "any", label: t("console.any") }, ...areas.map((area) => ({ value: area, label: area }))],
            classOptions: [{ value: "any", label: t("console.any") }, ...classes.map((cls) => ({ value: cls, label: t(`ver08.class.${cls}`) }))],
            summary: t("ver08.summary"),
            pager: t("ver08.pager"),
            endNote: t("ver08.endNote"),
            pages: t("ver08.pages"),
            caption: t("ver08.entries"),
            sortNote: t("ver08.sortNote"),
            // The empty sentence is never shown without the register line, so it is repeated under it (AC-FR-VER-041-02).
            empty: {
              title: t("ver08.emptyTitle"),
              text: register !== null ? t("ver08.emptyRegister", { line: registerLine(register, t, locale) }) : null,
            },
          }}
          loading={data === null ? LOADING_ROWS : false}
          locale={locale}
        />
      )}
    </Panel>
  );
}

/** One entry's cells: the premises, its reference and address, its class in words, its last status and deadline. */
function entryCells(entry: SupplyEntry, t: Translate, locale: Locale): Record<string, unknown> {
  return {
    name: entry.premises,
    ref: entry.reference,
    addr: entry.address,
    cls: { text: t(`ver08.class.${entry.class}`), ...(entry.detail !== null ? { detail: classDetail(entry.detail, t) } : {}) },
    last: lastStatus(entry.lastStatus, t),
    since: entry.since,
    deadline:
      entry.deadline === null
        ? t("ver08.noDeadline")
        : t(entry.deadline.kind === "WITHIN" ? "ver08.within" : "ver08.past", { d: date(entry.deadline.date, locale) }),
  };
}

/** The decision a class waits on is named as a decision; a reported change by its own reference. */
function classDetail(detail: NonNullable<SupplyEntry["detail"]>, t: Translate): string {
  return detail.kind === "DECISION" ? t("ver08.decision", { r: detail.reference }) : detail.reference;
}

/** The last status in words: in force with the seal, suspended in attention, or none yet. */
function lastStatus(status: SupplyEntry["lastStatus"], t: Translate): Record<string, unknown> {
  switch (status) {
    case "IN_FORCE":
      return { family: "info", label: t("ver.inForce"), variant: "seal" };
    case "SUSPENDED":
      return { family: "attention", label: t("ver08.suspendedState") };
    case null:
      return { missing: t("ver08.noStatus") };
  }
}

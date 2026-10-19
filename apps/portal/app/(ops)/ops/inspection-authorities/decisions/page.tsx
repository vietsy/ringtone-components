import {
  ApprovalPair,
  Banner,
  Columns,
  FactList,
  FileList,
  PageHeader,
  Panel,
  StatusLine,
  Table,
  Tabs,
  ViewState,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { DecisionForm } from "@/features/inspection/DecisionForm";
import { decideDesignationAct } from "@/features/inspection/standing-actions";
import { decisionTabs } from "@/features/inspection/standing";
import { date, joined, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import { readForPage } from "@/lib/api/flash";
import { loadDesignationDecisions, type DesignationDecisions, type RowAttempt } from "@/lib/api/inspection";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/** Refusals of a decision that take the form's place (design/03 SCR-VER-10, Refused). */
const IN_PLACE = new Set(["NOT_PENDING_APPROVAL", "AUTHORITY_NOT_FOUND"]);

/**
 * SCR-VER-10 Decide a designation. The approver reads the designations waiting, oldest first, opens one and
 * approves or refuses it. Whoever recorded it is shown the decision unavailable with the segregation refusal, and
 * a reader without the approval right with theirs (DR-746 rows 1 and 2, in that order).
 */
export default async function DesignationDecisionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The approver decides; an operations officer reads what waits, including what they recorded themselves.
  const staff = await requireStaff("ACT-BIZ-APR", "ACT-OPS");
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, ["loading"] as const);
  const attempt = readForPage<RowAttempt>(params);
  const opened = text(params.designation);
  const outcome = view === "loading" ? null : await loadDesignationDecisions(staff, opened, text(params.decided), locale);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="inspection" staff={staff} searchLabel={t("ver10.search")} keyMap={[{ keys: ["J", "K"], label: t("ver.kRows") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("console.crumb") }]}
          title={t("ver10.title")}
          {...(data !== null ? { meta: t("ver10.meta", { n: data.waiting.length, t: timestamp(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        <Tabs
          tabs={decisionTabs(t, data?.waiting.length ?? 0, data?.appointmentsWaiting ?? 0)}
          value="designations"
          label={t("ver10.tabsLabel")}
          density="console"
          locale={locale}
        />
        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("ver.errTitle")}
            errorText={t("ver.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="console"
            level={2}
            locale={locale}
          />
        ) : (
          <Decisions data={data} attempt={attempt?.act === "decide" ? attempt : null} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Decisions({ data, attempt, t, locale }: { data: DesignationDecisions | null; attempt: RowAttempt | null; t: Translate; locale: Locale }) {
  const opened = data?.opened ?? null;
  const decided = data?.decided ?? null;
  // A refusal the decision got that the board draws in place of the form, or the read's own.
  const inPlace = data?.openedRefusal ?? (attempt !== null && IN_PLACE.has(attempt.refusal) ? attempt.refusal : null);

  return (
    <>
      {decided !== null && (
        <StatusLine
          family="positive"
          text={t(decided.state === "ACTIVE" ? "ver10.approved" : "ver10.refused", { t: timestamp(decided.at, locale), a: decided.code })}
          locale={locale}
        />
      )}
      <Columns layout="halves">
        <Panel title={t("ver10.waiting")} level={2} density="console" locale={locale}>
          <Table
            columns={[
              { key: "code", label: t("ver09.cCode"), kind: "mono" },
              { key: "name", label: t("ver09.cName"), kind: "strong" },
              { key: "from", label: t("ver10.cFrom"), kind: "date", short: true },
              { key: "by", label: t("ver10.cBy") },
              { key: "age", label: t("ver10.cAge"), nowrap: true },
            ]}
            rows={(data?.waiting ?? []).map((row) => ({
              _key: row.id,
              _href: routes.opsDesignationDecisions({ designation: row.id }),
              ...(opened?.designation.id === row.id ? { _selected: true } : {}),
              code: row.code,
              name: row.name,
              from: row.from,
              by: row.recordedBy?.name ?? { missing: t("ver10.byUnknown") },
              age: row.recordedBy === null ? { missing: t("ver10.byUnknown") } : waited(row.recordedBy.at, data?.asOf ?? row.recordedBy.at, t),
            }))}
            loading={data === null ? 2 : false}
            density="console"
            rowFocus
            caption={t("ver10.waiting")}
            {...(data !== null && data.waiting.length > 0 ? { sortNote: t("ver10.sortNote") } : {})}
            empty={{ variant: "governed", title: t("ver10.emptyTitle"), action: false }}
            locale={locale}
          />
        </Panel>
        {inPlace !== null ? (
          <Banner family={inPlace === "NOT_PENDING_APPROVAL" ? "neutral" : "attention"} title={refusalOf(t, inPlace).title} code={inPlace} density="console" locale={locale}>
            {refusalOf(t, inPlace).text}
          </Banner>
        ) : (
          opened !== null && <Opened opened={opened} attempt={attempt} t={t} locale={locale} />
        )}
      </Columns>
    </>
  );
}

/** "19 giờ", "2 ngày": how long a designation has waited, in the larger unit that is whole. */
function waited(since: string, asOf: string, t: Translate): string {
  const hours = Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(since)) / 3_600_000));
  return hours < 48 ? t("ver10.hours", { n: hours }) : t("ver10.days", { n: Math.floor(hours / 24) });
}

function Opened({
  opened,
  attempt,
  t,
  locale,
}: {
  opened: NonNullable<DesignationDecisions["opened"]>;
  attempt: RowAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const { designation, bar } = opened;
  const name = `${designation.code} – ${designation.name}`;
  const segregation = bar === "SEGREGATION_REQUIRED" ? refusalOf(t, bar) : null;
  const sent = attempt?.id === designation.id ? attempt : null;

  return (
    <Panel title={name} level={2} gap="xl" density="console" locale={locale}>
      <FactList
        items={[
          { label: t("ver09.cLevel"), value: t(`console.level.${designation.level}`) },
          { label: t("ver09.basis"), value: designation.legalBasis, missing: t("ver06.none") },
          { label: t("ver09.geography"), value: designation.geography },
          { label: t("ver09.cAreas"), value: joined(t, designation.areas) },
          designation.to !== null
            ? { label: t("ver09.cPeriod"), value: { from: designation.from, to: designation.to }, kind: "period" }
            : { label: t("ver09.cPeriod"), value: t("ver09.openPeriod", { d: date(designation.from, locale) }) },
          { label: t("ver09.succeeds"), value: designation.predecessor !== null ? `${designation.predecessor.code} – ${designation.predecessor.name}` : t("ver09.none") },
        ]}
        density="console"
        locale={locale}
      />
      {designation.document !== null && (
        <FileList
          label={t("ver09.document")}
          items={[{ key: designation.document.name, name: designation.document.name, type: "pdf", size: designation.document.size, at: designation.document.at, by: designation.document.by, state: "ready" }]}
          density="console"
          locale={locale}
        />
      )}
      {designation.recordedBy !== null && (
        <ApprovalPair
          preparer={{ name: designation.recordedBy.name, role: t("ver10.opsRole"), at: designation.recordedBy.at }}
          approver={null}
          awaiting={t("ver10.awaiting")}
          preparerLabel={t("ver10.preparer")}
          approverLabel={t("ver10.approver")}
          {...(segregation !== null ? { sameActor: { ...segregation, family: "attention" as const } } : {})}
          locale={locale}
        />
      )}
      {bar === "NOT_AUTHORISED" && (
        <Banner family="attention" title={refusalOf(t, bar).title} code={bar} density="console" locale={locale}>
          {refusalOf(t, bar).text}
        </Banner>
      )}
      {sent !== null && sent.refusal !== "REASON_REQUIRED" && !IN_PLACE.has(sent.refusal) && (
        <Banner family="attention" title={refusalOf(t, sent.refusal).title} code={sent.refusal} density="console" locale={locale}>
          {refusalOf(t, sent.refusal).text}
        </Banner>
      )}
      <DecisionForm
        action={decideDesignationAct}
        id={designation.id}
        words={{
          decision: t("ver10.decision"),
          approve: t("ver10.approve"),
          refuse: t("ver10.refuse"),
          reason: t("ver10.reason"),
          reasonHelp: t("ver10.reasonHelp"),
          record: t("ver10.record"),
          close: t("ver.close"),
          cancel: t("ver.cancel"),
        }}
        initial={{ decision: sent?.decision ?? "APPROVE", reason: sent?.reason ?? "" }}
        reasonError={sent?.refusal === "REASON_REQUIRED" ? refusalSentence(t, sent.refusal) : null}
        barred={bar !== null ? refusalOf(t, bar).title : null}
        confirm={{
          title: t("ver10.approveTitle", { a: name }),
          description: t("ver10.approveText", { d: date(designation.from, locale), k: joined(t, designation.areas) }),
        }}
        closeHref={routes.ops()}
        locale={locale}
      />
    </Panel>
  );
}

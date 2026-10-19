import { Banner, Button, FactList, PageHeader, Pagination, SidePanel, StatusLine } from "@/components/r1";
import { ConsoleFailure, ConsoleFrame } from "@/features/inspection/ConsoleFrame";
import { WorkFilter } from "@/features/inspection/Filters";
import { closeInspectionAct } from "@/features/inspection/record-actions";
import { RowDialogTable, type DialogRow } from "@/features/inspection/RowDialogTable";
import { challengeText, date, deliveryText, findingsText, followUpText, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import { readForPage } from "@/lib/api/flash";
import { WORK_FLAGS, loadAuthorityWork, type AuthorityWork, type RowAttempt, type WorkFlag, type WorkRow } from "@/lib/api/inspection";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);
const DAY_MS = 86_400_000;
/** Header refusals said with Retry. */
const RETRYABLE = new Set(["PREMISES_READ_UNAVAILABLE", "POLICY_READ_UNAVAILABLE"]);

/**
 * SCR-VER-18 Inspections and records of the authority. On the desk, an inspector follows what the authority
 * must act on - a record that did not reach the premises, one a case requires corrected, an inspection open too
 * long or whose inspector has left, a follow-up overdue - oldest first, opens any record by its reference, closes
 * an inspection whose inspector can no longer act, and goes on to correct a record (SCR-VER-15).
 */
export default async function AuthorityWorkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Signed in as an inspector, or sent to sign in.
  const inspector = await requireInspector();
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, ["loading"] as const);
  const asked = text(params.flag);
  const flag = WORK_FLAGS.find((candidate) => candidate === asked) ?? null;
  const attempt = readForPage<RowAttempt>(params);
  // A page of the rows by the cursor the previous page gave (GET /inspections, `cursor`).
  const cursor = text(params.cursor);
  const outcome =
    view === "loading"
      ? null
      : await loadAuthorityWork(inspector.sessionId, flag, text(params.record), text(params.closed), attempt?.act === "close" ? attempt : null, locale, cursor);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <ConsoleFrame
      account={inspector.account}
      current="records"
      keyMap={[
        { keys: ["J", "K"], label: t("ver.kRows") },
        { keys: ["Enter"], label: t("ver18.kOpen") },
        { keys: ["Esc"], label: t("ver18.kClose") },
      ]}
      t={t}
      locale={locale}
    >
      <PageHeader
        crumbs={[{ label: t("console.crumb") }]}
        title={t("ver18.title")}
        {...(data !== null ? { meta: t("ver18.meta", { t: timestamp(data.asOf, locale) }) } : {})}
        locale={locale}
      />
      {failure !== null ? <ConsoleFailure failure={failure} refusals={["NOT_AUTHORISED"]} t={t} locale={locale} /> : <Work data={data} flag={flag} t={t} locale={locale} />}
    </ConsoleFrame>
  );
}

function Work({ data, flag, t, locale }: { data: AuthorityWork | null; flag: WorkFlag | null; t: Translate; locale: Locale }) {
  const refusal = data?.refusal ?? null;
  const rows = data?.rows ?? [];
  const closed = data?.closed ?? null;
  const closing = data?.closing ?? null;
  const shown: DialogRow[] = rows.map((row) => workRow(row, data?.asOf ?? row.since, closing, t, locale));
  if (closed !== null) {
    shown.push({
      key: closed.reference,
      cells: { _changed: true, ref: closed.reference, auth: "", prem: closed.premises, flag: { family: "neutral", label: t("ver18.closed") }, age: null },
      acts: [],
    });
  }

  return (
    <>
      {refusal !== null && (
        <Banner
          family="attention"
          title={refusalOf(t, refusal).title}
          code={refusal}
          {...(RETRYABLE.has(refusal) ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.inspectionWork() } } : {})}
          density="console"
          locale={locale}
        >
          {refusalOf(t, refusal).text}
        </Banner>
      )}
      {closed !== null && <StatusLine family="positive" text={t("ver18.closedLine", { r: closed.reference })} live locale={locale} />}
      <WorkFilter
        flags={[{ value: "ANY", label: t("ver18.flag.ANY") }, ...WORK_FLAGS.map((value) => ({ value, label: t(`ver18.flag.${value}`) }))]}
        flag={flag ?? "ANY"}
        record={data?.openedRef ?? ""}
        words={{ filters: t("ver18.filters"), flagLabel: t("ver18.filter"), recordRef: t("ver.recordRef"), open: t("ver18.open"), openWhy: t("ver18.openWhy") }}
        chip={flag !== null ? t("ver18.chip", { f: t(`ver18.flag.${flag}`) }) : null}
        summary={data !== null ? t("ver18.pager", { n: rows.length }) : null}
        locale={locale}
      />
      {data !== null && data.rowsRefusal !== null && (
        <Banner
          family="attention"
          title={refusalOf(t, data.rowsRefusal).title}
          code={data.rowsRefusal}
          density="console"
          locale={locale}
        >
          {refusalOf(t, data.rowsRefusal).text}
        </Banner>
      )}
      {data !== null && data.openedRefusal !== null && (
        <Banner family="attention" title={refusalOf(t, data.openedRefusal).title} code={data.openedRefusal} density="console" locale={locale}>
          {refusalOf(t, data.openedRefusal).text}
        </Banner>
      )}
      <RowDialogTable
        columns={[
          { key: "ref", label: t("ver18.cRef"), kind: "id" },
          { key: "auth", label: t("ver18.cAuth"), kind: "mono" },
          { key: "prem", label: t("ver18.cPrem"), minWidth: "var(--space-48)" },
          { key: "flag", label: t("ver18.cFlag"), kind: "status", minWidth: "var(--space-64)" },
          { key: "age", label: t("ver18.cAge"), nowrap: true },
          { key: "act", kind: "actions", minWidth: "var(--space-40)" },
        ]}
        rows={shown}
        action={closeInspectionAct}
        cancelLabel={t("ver.cancel")}
        open={closing !== null ? { row: `${closing.inspection}-INSPECTOR_CANNOT_ACT`, act: "close" } : null}
        caption={t("ver18.title")}
        {...(rows.length > 0 ? { sortNote: t("ver18.sortNote") } : {})}
        empty={
          flag !== null
            ? { variant: "filtered", title: t("ver18.filteredTitle"), action: false }
            : { variant: "governed", title: t("ver18.emptyTitle"), action: false }
        }
        loading={data === null ? 5 : false}
        rowFocus
        density="console"
        locale={locale}
      />
      {rows.length > 0 && data !== null && (
        <Pagination
          summary={t("ver18.pager", { n: rows.length })}
          hasPrev={data.cursor !== null}
          {...(data.cursor !== null ? { firstHref: routes.inspectionWork(flag !== null ? { flag } : {}) } : {})}
          hasNext={data.nextCursor !== null}
          {...(data.nextCursor !== null ? { nextHref: nextPage(flag, data.nextCursor) } : {})}
          endNote={t("ver18.endNote")}
          density="console"
          label={t("ver18.pages")}
          locale={locale}
        />
      )}
      <div style={{ display: "flex" }}>
        <Button variant="quiet" size="sm" href={routes.inspectionLists()} locale={locale}>
          {t("ver.close")}
        </Button>
      </div>
      {data !== null && data.opened !== null && <Opened opened={data.opened} t={t} locale={locale} />}
    </>
  );
}

/** One thing the authority must act on: its flag in words with what it names, its age, and its act. */
function workRow(row: WorkRow, asOf: string, closing: AuthorityWork["closing"], t: Translate, locale: Locale): DialogRow {
  const age = Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(row.since)) / DAY_MS));
  const detail = flagDetail(row, t, locale);
  const mine = closing !== null && closing.inspection === row.reference ? closing : null;
  const acts: DialogRow["acts"] =
    row.flag === "INSPECTOR_CANNOT_ACT"
      ? [
          {
            id: "close",
            label: t("ver18.closeInsp"),
            ariaLabel: `${t("ver18.closeInsp")} ${row.reference}`,
            variant: "secondary",
            dialog: {
              title: t("ver18.dlgTitle"),
              description: t("ver18.dlgText"),
              primary: { label: t("ver18.closeInsp"), variant: "danger" },
              facts: [
                { label: t("ver18.lInspection"), value: row.reference, kind: "id" },
                { label: t("ver18.cPrem"), value: row.premises },
                { label: t("ver18.lOpenedBy"), value: row.detail.person ?? "" },
              ],
              reason: {
                name: "reason",
                label: t("ver18.reason"),
                value: mine?.reason ?? "",
                ...(mine?.refusal === "REASON_REQUIRED" ? { error: refusalSentence(t, mine.refusal) } : {}),
              },
              ...(mine !== null && mine.refusal !== "REASON_REQUIRED" ? { refusal: refusalOf(t, mine.refusal) } : {}),
              hidden: { id: row.reference },
            },
          },
        ]
      : row.flag === "CORRECTION_DUE"
        ? [
            { id: "correct", label: t("ver18.correct"), ariaLabel: `${t("ver18.correct")} ${row.reference}`, variant: "secondary", href: routes.inspectionCorrection(row.reference, row.detail.case ?? undefined) },
            { id: "open", label: t("ver18.open"), ariaLabel: `${t("ver18.open")} ${row.reference}`, variant: "quiet", href: routes.inspectionWork({ record: row.reference }) },
          ]
        : row.kind === "RECORD"
          ? [{ id: "open", label: t("ver18.open"), ariaLabel: `${t("ver18.open")} ${row.reference}`, variant: "quiet", href: routes.inspectionWork({ record: row.reference }) }]
          : [];
  return {
    key: `${row.reference}-${row.flag}`,
    cells: {
      ...(row.kind === "RECORD" ? { _href: routes.inspectionWork({ record: row.reference }) } : {}),
      ref: row.reference,
      auth: row.authorityCode,
      prem: row.premises,
      flag: { family: "attention", label: t(`ver18.flag.${row.flag}`), detail },
      age: t("ver18.days", { n: age }),
    },
    acts,
  };
}

function flagDetail(row: WorkRow, t: Translate, locale: Locale): string {
  const day = row.detail.date !== null ? date(row.detail.date, locale) : "";
  switch (row.flag) {
    case "UNDELIVERED":
      return t("ver18.dUndelivered", { d: day });
    case "CORRECTION_DUE":
      return t("ver18.dCorrection", { c: row.detail.case ?? "" });
    case "INSPECTOR_CANNOT_ACT":
      return t("ver18.dCannot", { p: row.detail.person ?? "", d: day });
    case "FOLLOW_UP_OVERDUE":
      return t("ver18.dFollow", { d: day });
    case "OPEN_BEYOND_INTERVAL":
      return t("ver18.dOpen", { t: row.detail.date !== null ? timestamp(row.detail.date, locale) : "" });
  }
}

/** The page after this one, by the cursor this page gave, with the flag kept. */
function nextPage(flag: WorkFlag | null, after: string): string {
  const cursor = after;
  return routes.inspectionWork(flag !== null ? { flag, cursor } : { cursor });
}

/** The record opened by reference, beside the list: whole for the issuing authority, its confirmation for another. */
function Opened({ opened, t, locale }: { opened: NonNullable<AuthorityWork["opened"]>; t: Translate; locale: Locale }) {
  const { record } = opened;
  const delivery = deliveryText(t, record.delivery, locale);
  return (
    <SidePanel
      title={t("ver18.recordTitle", { r: record.reference, n: record.version, p: record.premises.name })}
      eyebrow={t("ver18.recordEyebrow")}
      status={{ family: "info", label: t("ver06.versionInForce") }}
      {...(opened.correctionCase !== null
        ? { actions: [{ label: t("ver18.correct"), variant: "primary" as const, href: routes.inspectionCorrection(record.reference, opened.correctionCase) }] }
        : {})}
      open
      density="console"
      locale={locale}
    >
      <FactList
        items={
          opened.whole
            ? [
                { label: t("ver06.lAuthority"), value: record.authority },
                { label: t("ver06.lInspector"), value: t("ver06.inspector", { name: record.inspector.name, card: record.inspector.card }) },
                { label: t("ver06.lAt"), value: record.inspectedAt, kind: "datetime" },
                { label: t("ver06.lFindings"), value: findingsText(t, record.findings, "list"), missing: t("ver06.none") },
                { label: t("ver06.lOutcome"), value: t(`ver.outcome.${record.outcome}`) },
                { label: t("ver13.lGuidance"), value: record.guidance, missing: t("ver06.none") },
                ...(record.referral !== null
                  ? [
                      { label: t("ver05.route"), value: t(`ver.route.${record.referral.route}`) },
                      { label: t("ver05.referralNote"), value: record.referral.note },
                    ]
                  : []),
                ...(record.statement !== null ? [{ label: t("ver05.statement"), value: record.statement }] : []),
                ...(record.delayReason !== null ? [{ label: t("ver05.delay"), value: record.delayReason }] : []),
                { label: t("ver06.lFollow"), value: followUpText(t, record.followUp, record.followUpBy, locale) },
                { label: t("ver06.lChallenge"), value: challengeText(t, record.challenge) },
                ...(record.correctedUnderCase !== null ? [{ label: t("ver06.lCorrection"), value: record.correctedUnderCase, kind: "id" as const }] : []),
                { label: t("ver06.delivery"), value: delivery },
                ...record.superseded.map((version) => ({
                  label: t("ver13.lEarlier", { n: version.version }),
                  value: t("ver13.superseded", { issued: date(version.issuedAt, locale), at: timestamp(version.supersededAt, locale) }),
                })),
              ]
            : [
                { label: t("ver06.lVersion"), value: String(record.version) },
                { label: t("ver06.lRecorded"), value: record.issuedAt, kind: "datetime" },
                { label: t("ver06.lAuthority"), value: record.authority },
                { label: t("ver06.lOutcome"), value: t(`ver.outcome.${record.outcome}`) },
                { label: t("ver06.lChallenge"), value: challengeText(t, record.challenge) },
              ]
        }
        density="console"
        locale={locale}
      />
    </SidePanel>
  );
}

import { FactList, PageHeader, Panel, Table, Tabs, ViewState } from "@/components/r1";
import type { StatusValue } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { day, financeTabs, finTranslator, moment, money, premisesLine } from "@/features/finance/console";
import { loadSuspense, type HeldAmountRow, type Suspense } from "@/lib/api/finance";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { FIN04_VIEWS } from "@/lib/mock/finance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The board's age bands, oldest first. */
const BANDS = [
  { id: "over30", from: 31 },
  { id: "8to30", from: 8 },
  { id: "upto7", from: 0 },
] as const;

/**
 * SCR-FIN-04 Suspense, the first of the finance workspace's tabs: every amount held in controlled suspense, in age
 * bands oldest first, with its reason, where it came from, who it is identified to and its state; the account they
 * are all held in; and the grounds cases relied on when they decided on held amounts, reportable as a set (FR-FIN-032).
 * An amount held because its refund is sought stays held for its payer, and is applied to nothing else, while the
 * grounds are not decided (FR-FIN-031, 073): its row says so, without a code, and offers no match.
 */
export default async function SuspensePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The finance officer works the queue; the finance approver and the auditor read it.
  const staff = await requireStaff("ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = finTranslator(locale);
  const view = reviewView(params, FIN04_VIEWS);
  const outcome = view === "loading" ? null : await loadSuspense(staff, view === "error" || view === "unavailable" ? view : null);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="finance"
      staff={staff}
      searchLabel={t("fin04.search")}
      keyMap={(data?.rows.length ?? 0) > 0 ? [{ keys: ["↑", "↓"], label: t("fin.kMove") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader title={t("fin04.title")} {...(data !== null ? { meta: meta(data, t, locale) } : {})} locale={locale} />
        <Tabs tabs={financeTabs(staff, data?.counts ?? null, t)} value="suspense" label={t("fin.tabs")} density="console" locale={locale} />
        {failure !== null ? <Failure failure={failure} t={t} locale={locale} /> : <Queue data={data} t={t} locale={locale} />}
      </div>
    </OpsFrame>
  );
}

/** "3 held amounts: … unmatched and … held for its payer; the oldest held for 12 days. As of …" */
function meta(data: Suspense, t: Translate, locale: Locale): string {
  const ts = moment(data.asOf, locale);
  if (data.rows.length === 0) return t("fin04.metaNone", { ts });
  const sum = (rows: readonly HeldAmountRow[]) => rows.reduce((total, row) => total + row.amountMinor, 0);
  const forPayer = data.rows.filter((row) => row.reason === "REFUND_SOUGHT");
  const unmatched = data.rows.filter((row) => row.reason !== "REFUND_SOUGHT");
  return t("fin04.meta", {
    n: data.rows.length,
    u: money(sum(unmatched), locale),
    h: money(sum(forPayer), locale),
    d: Math.max(...data.rows.map((row) => row.daysHeld)),
    ts,
  });
}

function Failure({ failure, t, locale }: { failure: { code: string; traceId: string | null; retryable: boolean }; t: Translate; locale: Locale }) {
  if (failure.code === "SRS_SERVICE_UNAVAILABLE") {
    return (
      <ViewState
        view="refused"
        refusal={{ code: failure.code, title: t("fin04.unTitle"), text: t("fin04.unText"), family: "attention", action: { label: t("fin.tryAgain"), icon: "refresh-cw", href: routes.opsSuspense() } }}
        level={2}
        density="console"
        locale={locale}
      />
    );
  }
  return (
    <ViewState
      view="error"
      errorTitle={t("fin.errTitle")}
      errorText={t("fin.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      level={2}
      density="console"
      locale={locale}
    />
  );
}

function Queue({ data, t, locale }: { data: Suspense | null; t: Translate; locale: Locale }) {
  return (
    <>
      <Panel compact density="console" locale={locale}>
        <Table
          columns={[
            { key: "ref", label: t("fin04.cRef"), kind: "id" },
            { key: "amount", label: t("fin04.cAmount"), kind: "money", unit: "VND" },
            { key: "held", label: t("fin04.cHeld"), kind: "stack", nowrap: true },
            { key: "why", label: t("fin04.cReason"), kind: "stack", minWidth: "var(--space-64)" },
            { key: "payer", label: t("fin04.cPayer"), kind: "stack" },
            { key: "st", label: t("fin04.cState"), kind: "status", minWidth: "var(--space-48)" },
          ]}
          rows={banded(data?.rows ?? [], t, locale)}
          loading={data === null ? 3 : false}
          density="console"
          rowFocus
          empty={{ variant: "not-started", title: t("fin04.emptyTitle") }}
          caption={t("fin04.title")}
          locale={locale}
        />
      </Panel>
      {data !== null ? (
        <Panel variant="plain" level={2} title={t("fin04.account")} description={t("fin04.accountDesc")} compact density="console" locale={locale}>
          <FactList
            columns={2}
            density="console"
            locale={locale}
            items={[
              { label: t("fin04.fHolder"), value: data.holdingAccount.holder, note: t("fin04.nHolder") },
              { label: t("fin04.fArrangement"), value: data.holdingAccount.arrangement, kind: "id", note: t("fin04.nArrangement", { d: day(data.holdingAccount.acceptedOn, locale) }) },
            ]}
          />
        </Panel>
      ) : null}
      {data !== null ? <Grounds data={data} t={t} locale={locale} /> : null}
    </>
  );
}

/** The held amounts under their age bands, oldest first, each band with its count. */
function banded(rows: readonly HeldAmountRow[], t: Translate, locale: Locale): Record<string, unknown>[] {
  return BANDS.flatMap((band, index) => {
    const upTo = index === 0 ? Number.POSITIVE_INFINITY : (BANDS[index - 1]?.from ?? 0) - 1;
    const members = rows.filter((row) => row.daysHeld >= band.from && row.daysHeld <= upTo);
    if (members.length === 0) return [];
    return [{ _key: `band-${band.id}`, _group: t(`fin04.band.${band.id}`), _groupCount: members.length }, ...members.map((row) => heldRow(row, t, locale))];
  });
}

function heldRow(row: HeldAmountRow, t: Translate, locale: Locale): Record<string, unknown> {
  return {
    _key: row.reference,
    // A refund sought opens the correction that seeks it; the disposition approval (SCR-FIN-05) has no page yet.
    ...(row.correction !== null ? { _href: routes.opsCorrections(row.correction) } : {}),
    ...(row.groundsReserved ? { _message: { severity: "neutral", text: t("fin04.reservedMsg") } } : {}),
    ref: row.reference,
    amount: row.amountMinor,
    held: { text: t("fin04.days", { n: row.daysHeld }), detail: t("fin04.since", { d: day(row.heldSince, locale) }) },
    why: { text: t(`fin04.reason.${row.reason}`), detail: sourceLine(row, t, locale) },
    payer:
      row.payer !== null
        ? { text: row.payer, ...(row.premises !== null ? { detail: premisesLine(row.premises) } : {}) }
        : { text: t("fin04.noPayer"), muted: true },
    st: stateValue(row, t, locale),
  };
}

/** Where the money came from, as the row's second line says it. */
function sourceLine(row: HeldAmountRow, t: Translate, locale: Locale): string {
  const source = row.source;
  switch (source.kind) {
    case "transfer":
      return source.content !== null ? t("fin04.srcTransfer", { d: day(source.receivedOn, locale), c: source.content }) : t("fin04.srcTransferPlain", { d: day(source.receivedOn, locale) });
    case "payment":
      return t("fin04.srcPayment", { payment: source.payment, decision: row.decision ?? "" });
    case "unexpired-term":
      return t("fin04.srcTerm", { d: day(source.endedOn, locale) });
  }
}

/** SM-328 as the queue words it: held, held identified to its payer, or proposed and waiting for a finance approver. */
function stateValue(row: HeldAmountRow, t: Translate, locale: Locale): StatusValue {
  if (row.proposal !== null) {
    return { family: "attention", label: t("fin04.sProposed"), detail: t(`fin04.proposed.${row.proposal.kind}`, { name: row.proposal.by, at: moment(row.proposal.at, locale) }) };
  }
  if (row.payer !== null) return { family: "neutral", label: t("fin04.sHeld"), detail: t("fin04.identified") };
  return { family: "neutral", label: t("fin04.sHeld") };
}

/** The grounds recorded on held amounts, one row each, so the set can be reconciled against the rule DEC-32 approves. */
function Grounds({ data, t, locale }: { data: Suspense; t: Translate; locale: Locale }) {
  return (
    <Panel variant="plain" level={2} title={t("fin04.grounds")} description={t("fin04.groundsDesc")} compact density="console" locale={locale}>
      <Table
        columns={[
          { key: "held", label: t("fin04.cRef"), kind: "id" },
          { key: "case", label: t("fin04.cCase"), kind: "id" },
          { key: "ground", label: t("fin04.cGround") },
          { key: "amount", label: t("fin04.cAmount"), kind: "money", unit: "VND" },
          { key: "at", label: t("fin04.cRecorded"), kind: "datetime" },
        ]}
        rows={data.grounds.map((entry) => ({
          _key: `${entry.held}-${entry.case}`,
          held: entry.held,
          case: entry.case,
          ground: t(`fin04.ground.${entry.ground}`),
          amount: entry.amountMinor,
          at: entry.recordedAt,
        }))}
        density="console"
        empty={{ variant: "not-started", title: t("fin04.groundsEmpty") }}
        caption={t("fin04.grounds")}
        locale={locale}
      />
    </Panel>
  );
}

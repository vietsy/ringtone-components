import {
  ApprovalPair,
  Banner,
  Button,
  Columns,
  Combobox,
  Divider,
  FactList,
  FilterBar,
  PageHeader,
  Panel,
  Select,
  SidePanel,
  Table,
  Tabs,
  TextField,
  ViewState,
} from "@/components/r1";
import type { StatusValue } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { proposeWriteOffAct } from "@/features/finance/actions";
import { financeTabs, finTranslator, moment, money, shortDay } from "@/features/finance/console";
import { loadOutstandingAmounts, type OutstandingAmounts, type OutstandingRow, type OutstandingState, type WriteOffProposalAttempt } from "@/lib/api/finance";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { FIN14_VIEWS } from "@/lib/mock/finance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const STATES: readonly OutstandingState[] = ["OUTSTANDING", "NOT_YET_DUE", "SETTLED", "ADJUSTED", "WRITTEN_OFF"];
/** SM-330's states in their families: only an amount past its due date is danger. */
const STATE_FAMILY = { OUTSTANDING: "danger", NOT_YET_DUE: "neutral", SETTLED: "neutral", ADJUSTED: "neutral", WRITTEN_OFF: "neutral" } as const;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-FIN-14 Outstanding amounts, the finance workspace's landing. One table in two groups under the reserved
 * consequence: what is past its due date, and what is owed with the due date ahead, each with the notices COM sent
 * for it; an amount whose write-off is proposed opens it on SCR-FIN-15, and any other opens its facts beside the
 * table, where the finance officer proposes the write-off of an outstanding amount.
 */
export default async function OutstandingAmountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The finance officer and the finance approver work here; the auditor reads.
  const staff = await requireStaff("ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = finTranslator(locale);
  const view = reviewView(params, FIN14_VIEWS);
  const askedState = text(params.state);
  const chosen = {
    state: STATES.find((state) => state === askedState) ?? null,
    premises: text(params.premises),
  };
  const outcome = view === "loading" ? null : await loadOutstandingAmounts(staff, chosen, text(params.amount), view);
  const kept = readForPage<WriteOffProposalAttempt>(params);
  const attempt = kept !== null && kept.page === "propose-write-off" ? kept : null;
  const proposes = holds(staff, "ACT-FIN-OP");
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="finance"
      staff={staff}
      searchLabel={t("fin14.search")}
      // The rows' keys are listed only while the table that binds them is on the page.
      keyMap={
        (data?.rows.length ?? 0) > 0
          ? [
              { keys: ["↑", "↓"], label: t("fin.kMove") },
              { keys: ["Enter"], label: t("fin14.kOpen") },
            ]
          : []
      }
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader title={t("fin14.title")} {...(data !== null ? { meta: meta(data, t, locale) } : {})} locale={locale} />
        <Tabs tabs={financeTabs(staff, data?.counts ?? null, t)} value="outstanding" label={t("fin.tabs")} density="console" locale={locale} />
        {failure !== null ? (
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
        ) : (
          <Amounts data={data} chosen={chosen} proposes={proposes} attempt={attempt} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

/** "1 outstanding, 2 not yet due. As of …", counted over the amounts the filter shows. */
function meta(data: OutstandingAmounts, t: Translate, locale: Locale): string {
  const shown = data.rows;
  return t("fin14.meta", {
    o: shown.filter((row) => row.state === "OUTSTANDING").length,
    n: shown.filter((row) => row.state === "NOT_YET_DUE").length,
    ts: moment(data.asOf, locale),
  });
}

function Amounts({
  data,
  chosen,
  proposes,
  attempt,
  t,
  locale,
}: {
  data: OutstandingAmounts | null;
  chosen: { state: OutstandingState | null; premises: string | null };
  /** The reader is a finance officer, who proposes write-offs. */
  proposes: boolean;
  attempt: WriteOffProposalAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const premisesName = data?.premises.find((entry) => entry.key === chosen.premises)?.name ?? null;
  const chips = [
    ...(chosen.state !== null ? [{ label: t("fin14.chipState", { s: t(`fin14.state.${chosen.state}`) }) }] : []),
    ...(premisesName !== null ? [{ label: t("fin14.chipPremises", { p: premisesName }) }] : []),
  ];
  const rows = data?.rows ?? [];
  const opened = data?.opened ?? null;
  const empty = data !== null && rows.length === 0;

  return (
    <>
      {/* The filters are the request's own fields: Show reads the list again with them. */}
      <form action={routes.opsFinance()}>
        <FilterBar
          chips={chips}
          {...(data !== null ? { summary: rows.length === 1 ? t("fin14.countOne") : t("fin14.count", { n: rows.length }) } : {})}
          active={chips.length > 0}
          label={t("fin14.filters")}
          shortcut="/"
          locale={locale}
        >
          <Select
            label={t("fin14.fState")}
            name="state"
            options={[{ value: "", label: t("fin14.anyState") }, ...STATES.map((state) => ({ value: state, label: t(`fin14.state.${state}`) }))]}
            value={chosen.state ?? ""}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
          <Combobox
            wrap
            label={t("fin14.fPremises")}
            name="premises"
            options={(data?.premises ?? []).map((entry) => ({ value: entry.key, label: entry.name, ...(entry.record !== null ? { detail: entry.record } : {}) }))}
            {...(chosen.premises !== null ? { value: chosen.premises } : {})}
            placeholder={t("fin14.anyPremises")}
            density="console"
            width="var(--container-xs)"
            locale={locale}
          />
          <Button variant="primary" size="sm" type="submit" loading={data === null} locale={locale}>
            {t("fin14.show")}
          </Button>
        </FilterBar>
      </form>
      {empty ? (
        <ViewState
          view="empty"
          empty={{
            variant: "filtered",
            title: premisesName !== null ? t("fin14.emptyTitle", { p: premisesName }) : t("fin14.emptyStateTitle", { s: chosen.state !== null ? t(`fin14.state.${chosen.state}`) : "" }),
            text: t("fin14.emptyText"),
            action: false,
          }}
          level={2}
          density="console"
          locale={locale}
        />
      ) : (
<Columns single={opened === null}>
          <Panel title={t("fin14.panel")} level={2} compact gap="md" density="console" locale={locale}>
            {data?.consequenceReserved === true ? <Banner family="neutral" title={t("fin14.resTitle")} compact density="console" locale={locale} /> : null}
            <Table
              columns={[
                { key: "ref", label: t("fin14.cRef"), kind: "id" },
                { key: "prem", label: t("fin14.cPrem"), kind: "stack", ...(opened === null ? { minWidth: "var(--space-40)" } : {}) },
                { key: "amount", label: t("fin14.cAmount"), kind: "money", unit: "VND" },
                { key: "due", label: t("fin14.cDue"), kind: "stack", nowrap: true, hidden: opened !== null },
                { key: "notices", label: t("fin14.cNotices"), kind: "stack", nowrap: true, hidden: opened !== null },
                { key: "st", label: t("fin14.cState"), kind: "status" },
              ]}
              rows={grouped(rows, opened, chosen, t, locale)}
              loading={data === null ? 3 : false}
              density="console"
              rowFocus
              {...(data !== null ? { sortNote: t("fin14.dueNote") } : {})}
              caption={t("fin14.panel")}
              locale={locale}
            />
          </Panel>
          {opened !== null ? (
            <Opened row={opened} proposes={proposes} attempt={attempt !== null && attempt.amount === opened.reference ? attempt : null} t={t} locale={locale} />
          ) : null}
        </Columns>
      )}
    </>
  );
}

/** The rows under their group headings, in SM-330's order, each heading with its count and what it means. */
function grouped(
  rows: readonly OutstandingRow[],
  opened: OutstandingRow | null,
  chosen: { state: OutstandingState | null; premises: string | null },
  t: Translate,
  locale: Locale,
): Record<string, unknown>[] {
  return STATES.flatMap((state) => {
    const members = rows.filter((row) => row.state === state);
    if (members.length === 0) return [];
    return [
      { _key: `group-${state}`, _group: t(`fin14.state.${state}`), _groupCount: members.length, _groupNote: t(`fin14.group.${state}`) },
      ...members.map((row) => amountRow(row, row.reference === opened?.reference, chosen, t, locale)),
    ];
  });
}

/** An amount whose write-off is proposed or decided opens SCR-FIN-15; any other opens its facts beside the table. */
function amountRow(
  row: OutstandingRow,
  selected: boolean,
  chosen: { state: OutstandingState | null; premises: string | null },
  t: Translate,
  locale: Locale,
): Record<string, unknown> {
  const message = rowMessage(row, t, locale);
  return {
    _key: row.reference,
    _href: row.proposal !== null || row.state === "WRITTEN_OFF" ? routes.opsWriteOff(row.reference) : routes.opsFinance({ ...chosen, amount: row.reference }),
    ...(selected ? { _selected: true } : {}),
    ...(message !== null ? { _message: { severity: "neutral", text: message } } : {}),
    ref: row.reference,
    prem: { text: row.premises.name, detail: row.premises.record !== null ? `${row.premises.record}, ${row.decision}` : row.decision },
    amount: row.amountMinor,
    due: {
      text: shortDay(row.dueOn, locale),
      ...(row.daysPastDue !== null ? { detail: t("fin14.pastDue", { n: row.daysPastDue }) } : {}),
    },
    notices:
      row.notices.overdue !== null || row.notices.reminder !== null
        ? {
            text: row.notices.overdue !== null ? t("fin14.overdueNotice", { d: shortDay(row.notices.overdue, locale) }) : t("fin14.reminder", { d: shortDay(row.notices.reminder ?? "", locale) }),
            ...(row.notices.overdue !== null && row.notices.reminder !== null ? { detail: t("fin14.reminder", { d: shortDay(row.notices.reminder, locale) }) } : {}),
          }
        : { text: t("fin14.noneYet"), muted: true },
    st: stateValue(row.state, t),
  };
}

function stateValue(state: OutstandingState, t: Translate): StatusValue {
  return { family: STATE_FAMILY[state], label: t(`fin14.state.${state}`) };
}

/**
 * A proposal waiting for the approver, the later decision that adjusted the amount, or the chargeback that made a
 * fee owed again, as the row's message.
 */
function rowMessage(row: OutstandingRow, t: Translate, locale: Locale): string | null {
  if (row.proposal !== null) {
    const { bankCharge, ground } = row.proposal;
    const proposed = t("fin14.woProposed", { name: row.proposal.by, ts: moment(row.proposal.at, locale), approver: row.proposal.approver });
    if (bankCharge !== null) return `${proposed} ${t("fin14.msgShort", { m: money(bankCharge.amountMinor, locale), payment: bankCharge.payment, d: shortDay(bankCharge.on, locale) })}`;
    return ground !== null ? `${proposed} ${t("fin14.msgGround", { g: ground })}` : proposed;
  }
  if (row.adjustedBy !== null) return t("fin14.adjusted", { decision: row.adjustedBy.decision, d: shortDay(row.adjustedBy.from, locale) });
  if (row.owedAgain !== null && (row.state === "NOT_YET_DUE" || row.state === "OUTSTANDING")) {
    const { chargebackOn, instruction } = row.owedAgain;
    return instruction !== null
      ? t("fin14.reversed", { c: shortDay(chargebackOn, locale), ins: instruction.reference, v: shortDay(instruction.validTo, locale) })
      : t("fin14.reversedOnly", { c: shortDay(chargebackOn, locale) });
  }
  return null;
}

/** The notices sent, as the side panel states them: both, either, or none yet. */
function noticesLine(row: OutstandingRow, t: Translate, locale: Locale): string {
  const { reminder, overdue } = row.notices;
  if (reminder !== null && overdue !== null) return t("fin14.noticesValue", { d: shortDay(reminder, locale), o: shortDay(overdue, locale) });
  if (overdue !== null) return t("fin14.overdueNotice", { d: shortDay(overdue, locale) });
  if (reminder !== null) return t("fin14.reminder", { d: shortDay(reminder, locale) });
  return t("fin14.noneYet");
}

/**
 * The amount opened beside the table: its facts, its write-off proposal with the approver it waits for, and for the
 * finance officer, on an amount past its due date with no proposal waiting, Propose a write-off.
 */
function Opened({
  row,
  proposes,
  attempt,
  t,
  locale,
}: {
  row: OutstandingRow;
  proposes: boolean;
  attempt: WriteOffProposalAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  return (
    <SidePanel
      title={row.reference}
      eyebrow={t("fin14.eyebrow")}
      status={stateValue(row.state, t)}
      {...(row.proposal !== null ? { actions: [{ label: t("fin14.openWo"), href: routes.opsWriteOff(row.reference), variant: "secondary" }] } : {})}
      density="console"
      locale={locale}
    >
      <FactList
        density="console"
        locale={locale}
        items={[
          { label: t("fin14.fAmount"), value: { amountMinor: row.amountMinor, currency: "VND" }, kind: "money" },
          { label: t("fin14.fPremises"), value: row.premises.name, ...(row.premises.record !== null ? { note: row.premises.record } : {}) },
          { label: t("fin14.fDecision"), value: row.decision, kind: "id" },
          { label: t("fin14.fDue"), value: row.dueOn, kind: "date" },
          ...(row.outstandingSince !== null && row.daysPastDue !== null
            ? [{ label: t("fin14.fSince"), value: row.outstandingSince, kind: "date" as const, note: t("fin14.sinceNote", { n: row.daysPastDue }) }]
            : []),
          ...(row.adjustedBy !== null
            ? [{ label: t("fin14.fAdjusted"), value: row.adjustedBy.decision, kind: "id" as const, note: t("fin14.adjustedNote", { d: shortDay(row.adjustedBy.from, locale) }) }]
            : []),
          { label: t("fin14.fNotices"), value: noticesLine(row, t, locale) },
          { label: t("fin14.fConsequence"), value: t("fin14.consequence"), note: t("fin14.consequenceNote") },
        ]}
      />
      {row.proposal !== null ? (
        <>
          <Divider />
          <Panel variant="plain" level={3} title={t("fin14.proposal")} compact gap="md" density="console" locale={locale}>
            <FactList
              density="console"
              locale={locale}
              items={[
                { label: t("fin14.fAuthority"), value: t("fin14.authority") },
                { label: t("fin14.fGround"), value: row.proposal.ground ?? t("fin14.ground") },
              ]}
            />
            <ApprovalPair
              preparer={{ name: row.proposal.by, role: t("fin.officer"), at: row.proposal.at }}
              approver={null}
              awaiting={t("fin14.waitApprover", { approver: row.proposal.approver })}
              locale={locale}
            />
          </Panel>
        </>
      ) : null}
      {proposes && row.writeOffOpen ? (
        <>
          <Divider />
          <ProposeWriteOff row={row} attempt={attempt} t={t} locale={locale} />
        </>
      ) : null}
    </SidePanel>
  );
}

/**
 * Propose a write-off: the ground in the officer's words. The proposal names the authority in force, and a finance
 * approver other than the officer decides it on SCR-FIN-15. A refusal is drawn where the act was, the ground as typed.
 */
function ProposeWriteOff({ row, attempt, t, locale }: { row: OutstandingRow; attempt: WriteOffProposalAttempt | null; t: Translate; locale: Locale }) {
  const refused = attempt !== null && attempt.field === null ? attempt.code : null;
  return (
    <form action={proposeWriteOffAct}>
      <input type="hidden" name="amount" value={row.reference} />
      <Panel variant="plain" level={3} title={t("fin14.propose")} description={t("fin14.proposeDesc")} compact gap="md" density="console" locale={locale}>
        {refused !== null ? (
          <Banner family="attention" title={refused === "FIN_IDEMPOTENCY_CONFLICT" ? t("fin14.proposeConflict") : t("fin.notAccessibleTitle")} code={refused} live density="console" locale={locale}>
            {refused === "FIN_IDEMPOTENCY_CONFLICT" ? t("fin.conflictText") : t("fin.notAccessibleText")}
          </Banner>
        ) : null}
        <TextField
          label={t("fin14.fGround")}
          helper={t("fin14.groundHelp")}
          name="ground"
          value={attempt?.ground ?? ""}
          {...(attempt?.field === "ground" ? { error: t("fin14.groundMissing") } : {})}
          required
          density="console"
          locale={locale}
        />
        <div>
          <Button variant="primary" size="sm" type="submit" locale={locale}>
            {t("fin14.propose")}
          </Button>
        </div>
      </Panel>
    </form>
  );
}

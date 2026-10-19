import {
  ApprovalPair,
  Banner,
  Breakdown,
  Button,
  Columns,
  Divider,
  FactList,
  PageHeader,
  Panel,
  Skeleton,
  Toast,
  ViewState,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { decideWriteOffAct } from "@/features/finance/actions";
import { day, finTranslator, moment, money, period, shortDay } from "@/features/finance/console";
import { ApproverDecision } from "@/features/finance/ApproverDecision";
import { loadWriteOff, type WriteOff, type WriteOffAttempt, type WriteOffDone } from "@/lib/api/finance";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { FIN15_VIEWS } from "@/lib/mock/finance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;


/**
 * SCR-FIN-15 Write-off approval, for any amount owed a write-off has been proposed on. The finance approver reads the
 * amount left unpaid, its age and notices, and the authority and ground the proposal names, then approves the
 * write-off or declines it with a reason. The officer who
 * proposed it reads it waiting for a finance approver, and reads the decision once it is taken; an approver who
 * proposed it reads it under the segregation line, without the decision.
 */
export default async function WriteOffPage({ params, searchParams }: { params: Promise<{ amount: string }>; searchParams: Promise<SearchParams> }) {
  // The finance approver decides; the finance officer and the auditor read.
  const staff = await requireStaff("ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD");
  const [{ amount }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = finTranslator(locale);
  const view = reviewView(query, FIN15_VIEWS);
  const kept = readForPage<WriteOffAttempt | WriteOffDone>(query);
  const attempt = kept !== null && kept.amount === amount && "refusal" in kept ? kept : null;
  const done = kept !== null && kept.amount === amount && "done" in kept ? kept : null;
  const outcome = view === "loading" ? null : await loadWriteOff(staff, amount, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="finance" staff={staff} searchLabel={t("fin15.search")} keyMap={[{ keys: ["Esc"], label: t("fin15.kEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[
            { label: t("fin.tabs"), href: routes.opsFinance() },
            { label: t("fin.tab.outstanding"), href: routes.opsFinance() },
            ...(data !== null ? [{ label: data.reference }] : []),
          ]}
          title={data !== null ? t("fin15.title", { r: data.reference }) : t("fin15.titlePlain")}
          {...(data !== null
            ? {
                status:
                  data.state === "WRITTEN_OFF" ? { family: "neutral" as const, label: t("fin14.state.WRITTEN_OFF") } : { family: "danger" as const, label: t("fin14.state.OUTSTANDING") },
                meta:
                  data.premises.record !== null
                    ? t("fin15.meta", { premises: data.premises.name, record: data.premises.record, decision: data.decision })
                    : t("fin15.metaPlain", { premises: data.premises.name, decision: data.decision }),
              }
            : {})}
          locale={locale}
        />
        {view === "loading" ? <Loading t={t} locale={locale} /> : null}
        {failure !== null ? <Unavailable failure={failure} t={t} locale={locale} /> : null}
        {data !== null ? <Content data={data} attempt={attempt} done={done} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** The notices sent on the amount: both, either, or none yet. */
function noticesLine(data: WriteOff, t: Translate, locale: Locale): string {
  const { reminder, overdue } = data.notices;
  if (reminder !== null && overdue !== null) return t("fin15.noticesValue", { d: shortDay(reminder, locale), o: shortDay(overdue, locale) });
  if (overdue !== null) return t("fin14.overdueNotice", { d: shortDay(overdue, locale) });
  if (reminder !== null) return t("fin14.reminder", { d: shortDay(reminder, locale) });
  return t("fin14.noneYet");
}

function Loading({ t, locale }: { t: Translate; locale: Locale }) {
  return (
    <Columns side="md">
      <Panel title={t("fin15.amount")} density="console" locale={locale}>
        <Skeleton variant="facts" rows={8} density="console" locale={locale} />
      </Panel>
      <Panel title={t("fin15.decision")} density="console" locale={locale}>
        <Skeleton variant="card" rows={4} density="console" locale={locale} />
      </Panel>
    </Columns>
  );
}

/** A write-off that does not exist or is not the reader's to see is a refusal with a way back; anything else is our outage. */
function Unavailable({ failure, t, locale }: { failure: { code: string; traceId: string | null; retryable: boolean }; t: Translate; locale: Locale }) {
  if (failure.code !== "SRS_RESOURCE_NOT_ACCESSIBLE") {
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
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
      <ViewState view="refused" refusal={{ code: failure.code, title: t("fin15.nfTitle"), text: t("fin15.nfText"), family: "attention" }} level={2} density="console" locale={locale} />
      <Button variant="secondary" size="sm" href={routes.opsFinance()} locale={locale}>
        {t("fin15.back")}
      </Button>
    </div>
  );
}

function Content({ data, attempt, done, t, locale }: { data: WriteOff; attempt: WriteOffAttempt | null; done: WriteOffDone | null; t: Translate; locale: Locale }) {
  const outcome = data.outcome;
  // The toast confirms the act just taken by this reader, once, on the page the act redirected to.
  const toast =
    done !== null && outcome !== null
      ? outcome.decision === "approved"
        ? {
            family: "positive" as const,
            title: t("fin15.okTitle", { r: data.reference, ts: moment(outcome.at, locale) }),
            text: t("fin15.okText", { premises: data.premises.name, decision: data.decision }),
          }
        : { family: "neutral" as const, title: t("fin15.noTitle"), text: t("fin15.noText", { r: data.reference }) }
      : null;
  return (
    <>
      {toast !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family={toast.family} title={toast.title} locale={locale}>
            {toast.text}
          </Toast>
        </div>
      ) : null}
      <Columns side="md">
        <Panel title={t("fin15.amount")} gap="xl" density="console" locale={locale}>
          <Breakdown
            title={t("fin15.bdTitle")}
            level={3}
            lines={[
              {
                label: t("fin15.lFee", { decision: data.decision }),
                ...(data.fee.period !== null ? { detail: t("fin15.lFeeDetail", { p: period(data.fee.period.from, data.fee.period.to, locale) }) } : {}),
                amountMinor: data.fee.amountMinor,
              },
              ...(data.received !== null
                ? [
                    {
                      label: t("fin15.lPaid", { d: day(data.received.on, locale) }),
                      detail: t("fin15.lPaidDetail", { payment: data.received.payment, m: money(data.received.bankChargeMinor, locale) }),
                      amountMinor: data.received.amountMinor,
                      kind: "subtract" as const,
                    },
                  ]
                : []),
              { label: t("fin15.lLeft"), amountMinor: data.leftMinor, kind: "total" },
            ]}
            locale={locale}
          />
          <FactList
            density="console"
            locale={locale}
            items={[
              { label: t("fin15.fPayer"), value: data.payer, note: data.premises.record !== null ? `${data.premises.name}, ${data.premises.record}` : data.premises.name },
              {
                label: t("fin15.fDue"),
                value: data.dueOn,
                kind: "date",
                ...(data.useBeganOn !== null ? { note: t("fin15.dueNote", { d: day(data.useBeganOn, locale) }) } : {}),
              },
              { label: t("fin15.fSince"), value: data.outstandingSince, kind: "date", note: t("fin15.sinceNote", { n: data.daysPastDue }) },
              { label: t("fin15.fNotices"), value: noticesLine(data, t, locale) },
              { label: t("fin15.fConsequence"), value: t("fin15.consequence"), note: t("fin15.consequenceNote") },
            ]}
          />
          <Divider />
          <Panel variant="plain" level={3} title={t("fin15.proposal")} compact density="console" locale={locale}>
            <FactList
              density="console"
              locale={locale}
              items={[
                data.proposal.authority !== null
                  ? {
                      label: t("fin15.fAuthority"),
                      value: t("fin15.authority"),
                      note: t("fin15.authorityNote", { m: money(data.proposal.authority.threshold.amountMinor, locale), d: day(data.proposal.authority.threshold.recordedOn, locale) }),
                    }
                  : { label: t("fin15.fAuthority"), value: null, missing: t("fin15.authorityMissing") },
                { label: t("fin15.fGround"), value: data.proposal.ground ?? t("fin15.ground") },
              ]}
            />
          </Panel>
        </Panel>
        <Decision data={data} attempt={attempt} t={t} locale={locale} />
      </Columns>
    </>
  );
}

/** The decision panel: the proposer beside the approver, and what the reader may do there. */
function Decision({ data, attempt, t, locale }: { data: WriteOff; attempt: WriteOffAttempt | null; t: Translate; locale: Locale }) {
  const outcome = data.outcome;
  const refusal = attempt !== null && "code" in attempt.refusal ? attempt.refusal.code : null;
  // The segregation line stands for the reader who prepared it, or for the server's refusal of their own approval.
  const sameActor = data.reader === "same-actor" || refusal === "SOD_PREPARER_IS_APPROVER";
  const decides = data.reader === "approver" && outcome === null && !sameActor;
  return (
    <Panel title={t("fin15.decision")} gap="lg" density="console" locale={locale}>
      <ApprovalPair
        preparer={{ name: data.proposal.by, role: t("fin.officer"), at: data.proposal.at }}
        approver={outcome !== null ? { name: outcome.by, role: t("fin.approverRole"), at: outcome.at } : null}
        {...(outcome === null ? { awaiting: data.reader === "approver" ? t("fin15.waitYou") : t("fin15.waitOther") } : {})}
        {...(outcome !== null ? { decision: outcome.decision === "approved" ? "approved" : "rejected", comment: outcome.comment } : {})}
        {...(sameActor ? { sameActor: { code: "SOD_PREPARER_IS_APPROVER", title: t("fin15.sodTitle"), text: t("fin15.sodText"), family: "attention" } } : {})}
        preparerLabel={t("fin15.proposerLabel")}
        approverLabel={t("fin15.approverLabel")}
        locale={locale}
      />
      {refusal !== null && refusal !== "SOD_PREPARER_IS_APPROVER" && refusal !== "SRS_PAYLOAD_INVALID" ? (
        <Banner
          family="attention"
          title={refusal === "FIN_IDEMPOTENCY_CONFLICT" ? t("fin.conflictTitle") : t("fin.notAccessibleTitle")}
          code={refusal}
          live
          density="console"
          locale={locale}
        >
          {refusal === "FIN_IDEMPOTENCY_CONFLICT" ? t("fin.conflictText") : t("fin.notAccessibleText")}
        </Banner>
      ) : null}
      {decides ? (
        <ApproverDecision
          action={decideWriteOffAct}
          subject={{ name: "amount", value: data.reference }}
          copy={{
            reason: t("fin15.reason"),
            reasonHelp: t("fin15.reasonHelp"),
            approve: t("fin15.approve"),
            decline: t("fin15.decline"),
            dialogTitle: t("fin15.dlgTitle", { m: money(data.leftMinor, locale), r: data.reference }),
            dialogText: t("fin15.dlgText", { premises: data.premises.name }),
            dialogYes: t("fin15.dlgYes", { m: money(data.leftMinor, locale) }),
            dialogNo: t("fin15.dlgNo"),
          }}
          facts={[
            { label: t("fin15.fAuthority"), value: t("fin15.authority") },
            { label: t("fin15.fGround"), value: data.proposal.ground ?? t("fin15.ground") },
          ]}
          initialReason={attempt?.reason ?? ""}
          reasonError={attempt !== null && "field" in attempt.refusal ? t("fin15.eReason") : null}
          approveUnavailable={data.proposal.authority === null ? t("fin15.approveWhy", { name: data.proposal.by }) : null}
          locale={locale}
        />
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button variant="secondary" size="sm" href={routes.opsFinance()} locale={locale}>
            {t("fin15.back")}
          </Button>
        </div>
      )}
    </Panel>
  );
}

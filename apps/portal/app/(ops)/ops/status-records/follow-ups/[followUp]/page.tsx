import { Banner, Button, FactList, PageHeader, Panel, Skeleton, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { resolveFollowUpAction } from "@/features/status-records/actions";
import { ConsoleFailure } from "@/features/status-records/console";
import { ResolveFields } from "@/features/status-records/ResolveFields";
import { date, duration, followUpStatus, timestamp, written } from "@/features/status-records/words";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { loadFollowUpPage, type FollowUpAttempt, type FollowUpOutcome, type FollowUpPage } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER08_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const OUTCOMES: readonly FollowUpOutcome[] = ["AMEND", "REPLACE", "END_AT_EFFECTIVE_DATE", "NO_CHANGE_NEEDED"];

/**
 * SCR-CER-08 Resolve a follow-up. The officer resolves a re-decided obligation RightOne could not apply by itself:
 * the decisions it moves the record between, what changed, and the outcome the rule gives, preselected, with a
 * reason kept with the follow-up. A period recorded late is in force from the moment it is recorded.
 */
export default async function ResolveFollowUpPage({ params, searchParams }: { params: Promise<{ followUp: string }>; searchParams: Promise<SearchParams> }) {
  // Only an operations officer resolves.
  const staff = await requireStaff("ACT-OPS");
  const [{ followUp }, query] = await Promise.all([params, searchParams]);
  const ref = decodeURIComponent(followUp);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, CER08_VIEWS);
  const kept = view === null ? readForPage<FollowUpAttempt>(query) : null;
  const attempt = kept?.followUp === ref ? kept : null;
  const outcome = view === "loading" ? null : await loadFollowUpPage(staff.sessionId, ref, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="records" staff={staff} searchLabel={t("cer.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("cer08.crumb"), href: routes.opsStatusRecords() },
            { label: t("cer08.list"), href: routes.opsFollowUps() },
          ]}
          title={data !== null ? t("cer08.title", { cfu: data.reference, p: data.record.premises }) : t("cer08.titleGeneric")}
          {...(data !== null ? { status: followUpStatus(t, data.state), meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "var(--container-4xl)", minWidth: 0 }}>
            <Panel title={t("cer08.decisions")} level={2} compact locale={locale}>
              <Skeleton variant="facts" rows={6} density="console" locale={locale} />
            </Panel>
            <Panel title={t("cer08.resolution")} level={2} compact locale={locale}>
              <Skeleton variant="card" rows={4} density="console" locale={locale} />
            </Panel>
          </div>
        ) : failure !== null || data === null ? (
          failure !== null && (
            <ConsoleFailure
              failure={failure}
              refusals={{ FOLLOW_UP_NOT_FOUND: { title: "cer08.nfTitle", text: "cer.refusal.FOLLOW_UP_NOT_FOUND" } }}
              back={{ label: t("cer08.back"), href: routes.opsFollowUps() }}
              t={t}
              locale={locale}
            />
          )
        ) : (
          <Resolving data={data} attempt={attempt} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function meta(data: FollowUpPage, t: Translate, locale: Locale): string {
  const due = timestamp(data.dueBy, locale);
  if (data.applied !== null) {
    return data.applied.lateMs !== null
      ? t("cer08.metaDone", { due, at: timestamp(data.applied.at, locale), d: duration(t, data.applied.lateMs, locale) })
      : t("cer08.metaDoneOnTime", { due, at: timestamp(data.applied.at, locale) });
  }
  if (data.state === "OVERDUE") {
    const d = duration(t, Date.now() - Date.parse(data.dueBy), locale);
    return data.notApplied !== null ? t("cer08.meta", { due, d }) : t("cer08.metaOverdue", { due, d });
  }
  return t("cer08.metaOpen", { due });
}

function Resolving({ data, attempt, t, locale }: { data: FollowUpPage; attempt: FollowUpAttempt | null; t: Translate; locale: Locale }) {
  const applied = data.applied;
  const open = data.state === "OPEN" || data.state === "OVERDUE";
  const refusal = attempt?.refusal ?? null;
  const closed = !open && attempt?.done !== true;
  const obd = data.decision.reference;

  const facts = [
    { label: t("cer08.fRecord"), value: data.record.reference, kind: "id" as const },
    { label: t("cer08.fPremises"), value: data.record.premises, ...(data.record.register !== null ? { note: data.record.register } : {}) },
    { label: t("cer08.fNew"), value: obd, kind: "id" as const, missing: t("cer.decisionUnknown"), note: t("cer08.newInForce", { ts: timestamp(data.decision.inForceFrom, locale) }) },
    ...(data.superseded !== null ? [{ label: t("cer08.fOld"), value: data.superseded, kind: "id" as const, ...(open ? { note: t("cer08.oldNote") } : {}) }] : []),
    ...(data.change !== null ? [{ label: t("cer08.fChange"), value: written(data.change, locale) }] : []),
    { label: t("cer08.fHolder"), value: t("cer08.holderSame") },
    ...(open && data.periodInForce !== null ? [{ label: t("cer08.fPeriod"), value: data.periodInForce, kind: "period" as const }] : []),
    ...(applied !== null
      ? [
          {
            label: t("cer08.fOutcome"),
            value: t(`cer.outcomeDone.${applied.outcome}`),
            ...(obd !== null ? { note: t("cer08.newPeriod", { obd, ts: timestamp(applied.inForceFrom, locale) }) } : {}),
          },
          { label: t("cer08.fApplied"), value: applied.at, kind: "datetime" as const },
        ]
      : []),
  ];

  const helpers: Readonly<Record<FollowUpOutcome, string>> = {
    AMEND: t("cer08.oAmendHelp", { obd: obd ?? "" }),
    REPLACE: t("cer08.oReplaceHelp", { d: date(data.rule.cutOn, locale) }),
    END_AT_EFFECTIVE_DATE: t("cer08.oEndHelp", { d: date(data.rule.cutOn, locale) }),
    NO_CHANGE_NEEDED: t("cer08.oNoneHelp"),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "var(--container-4xl)", minWidth: 0 }}>
      {attempt?.done === true && applied !== null && (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t("cer08.toastTitle", { cfu: data.reference })} locale={locale}>
            {t("cer08.toastText", { ts: timestamp(applied.inForceFrom, locale) })}
          </Toast>
        </div>
      )}
      {(closed || refusal?.code === "FOLLOW_UP_CLOSED") && (
        <Banner
          family="attention"
          title={t("cer08.closedTitle")}
          code="FOLLOW_UP_CLOSED"
          action={{ label: t("cer08.back"), href: routes.opsFollowUps(), variant: "secondary" }}
          density="console"
          locale={locale}
        >
          {t("cer.refusal.FOLLOW_UP_CLOSED")}
        </Banner>
      )}
      {refusal !== null && refusal.field === null && refusal.code !== "FOLLOW_UP_CLOSED" && (
        <Banner family="attention" title={t("cer08.refusedTitle")} code={refusal.code} density="console" locale={locale}>
          {t(refusal.code === "DECISION_READ_UNAVAILABLE" || refusal.code === "PAYMENT_READ_UNAVAILABLE" ? `cer.refusal.${refusal.code}` : "cer.refusal.NOT_AUTHORISED")}
        </Banner>
      )}
      <Panel title={t("cer08.decisions")} level={2} action={{ label: t("cer08.openRecord"), href: routes.opsStatusRecord(data.record.key), kind: "link" }} compact locale={locale}>
        <FactList items={facts} columns={2} density="console" locale={locale} />
      </Panel>
      {open && (
        <form action={resolveFollowUpAction} noValidate style={{ display: "contents" }}>
          <input type="hidden" name="follow_up" value={data.reference} />
          <ResolveFields
            title={t("cer08.resolution")}
            outcomes={OUTCOMES.map((outcome) => ({ value: outcome, label: t(`cer.outcome.${outcome}`), helper: helpers[outcome] }))}
            values={{ outcome: attempt?.values.outcome ?? data.rule.outcome, reason: attempt?.values.reason ?? "" }}
            errors={{
              outcome: refusal?.field === "outcome" ? t("cer08.wrong") : null,
              reason: refusal?.field === "reason" ? t("cer.refusal.REASON_REQUIRED") : null,
            }}
            help={t(`cer08.help.${data.rule.outcome}`)}
            notice={
              data.rule.unmet !== null ? (
                // The rule's outcome, not a refusal: it names the unmet condition without a code (finding F-11).
                <Banner family="attention" title={t(`cer08.icTitle.${data.rule.unmet === "DECISION_SUPERSEDED" ? "DECISION_SUPERSEDED" : "PAYMENT_PENDING"}`)} density="console" locale={locale}>
                  {t("cer08.icText", { d: date(data.rule.cutOn, locale), obd: obd ?? "" })}
                </Banner>
              ) : null
            }
            cancelHref={routes.opsFollowUps()}
            words={{
              outcome: t("cer08.outcome"),
              reason: t("cer08.reason"),
              reasonHelp: t("cer08.reasonHelp"),
              resolve: t("cer08.resolve"),
              cancel: t("cer08.cancel"),
              resolveWhy: t("cer08.resolveWhy"),
            }}
            locale={locale}
          />
        </form>
      )}
      {applied !== null && (
        <Panel title={t("cer08.recorded")} level={2} compact locale={locale}>
          <FactList
            items={[
              { label: t("cer08.fOutcome"), value: t(`cer.outcomeDone.${applied.outcome}`) },
              ...(obd !== null ? [{ label: t("cer08.fNewPeriod"), value: t("cer08.newPeriod", { obd, ts: timestamp(applied.inForceFrom, locale) }) }] : []),
              { label: t("cer08.fBy"), value: applied.by ?? t("cer08.byRightOne") },
              {
                label: t("cer08.fLate"),
                value: applied.lateMs !== null ? duration(t, applied.lateMs, locale) : t("cer08.onTime"),
              },
              { label: t("cer08.fReason"), value: written(applied.reason, locale), missing: t("cer08.noReason") },
            ]}
            density="console"
            locale={locale}
          />
          <div>
            <Button variant="secondary" size="sm" href={routes.opsFollowUps()} locale={locale}>
              {t("cer08.back")}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

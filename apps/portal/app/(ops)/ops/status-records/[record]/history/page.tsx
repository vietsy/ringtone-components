import { Button, ButtonRow, PageHeader, Panel, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConsoleFailure } from "@/features/status-records/console";
import { R1_FORMAT } from "@rightone/formatting";
import { columnTime, duration, recordStatus, timestamp, written } from "@/features/status-records/words";
import { holds, requireStaff } from "@/lib/api/session";
import { loadRecordHistory, type ChangeAuthority, type RecordHistory } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER09_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const formatPeriod = (from: string, to: string, locale: Locale) => R1_FORMAT.formatPeriod(from, to, locale) ?? "";

/** A time in a column whose header states the zone once. */
const cell = (iso: string | null, locale: Locale) => (iso === null ? null : { text: columnTime(iso, locale), plain: true });

/**
 * SCR-CER-09 Record history. Which decision governed the record at every instant, every status change with the
 * authority it rests on and its ground, and every follow-up of a re-decided obligation with how late it was: for an
 * auditor, or an officer answering a complaint.
 */
export default async function RecordHistoryPage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  // The officer and the auditor read here.
  const staff = await requireStaff("ACT-OPS", "ACT-AUD");
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const key = decodeURIComponent(record);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, CER09_VIEWS);
  const outcome = view === "loading" ? null : await loadRecordHistory(staff.sessionId, key, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const reader = !holds(staff, "ACT-OPS");

  return (
    <OpsFrame console="operations" current="records" staff={staff} searchLabel={t("cer.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("cer09.crumb"), href: routes.opsStatusRecords() },
            ...((data?.reference !== undefined && data?.reference !== null) ? [{ label: data.reference, href: routes.opsStatusRecord(data.key) }] : []),
          ]}
          title={data === null ? t("cer09.titleGeneric") : data.reference !== null ? t("cer09.title", { ref: data.reference }) : t("cer09.titlePending", { p: data.premises })}
          {...(data !== null ? { status: recordStatus(t, data.status), meta: meta(data, t, locale) + (reader ? t("cer09.metaRead") : "") } : {})}
          locale={locale}
        />
        {failure !== null ? (
          <ConsoleFailure
            failure={failure}
            refusals={{ CERTIFICATE_NOT_FOUND: { title: "cer09.nfTitle", text: "cer.refusal.CERTIFICATE_NOT_FOUND" } }}
            back={{ label: t("cer09.backList"), href: routes.opsStatusRecords() }}
            t={t}
            locale={locale}
          />
        ) : (
          <History data={data} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function meta(data: RecordHistory, t: Translate, locale: Locale): string {
  const p = data.premises;
  const prm = data.register ?? "";
  const latest = data.latest;
  if (latest.kind === "amended") return t("cer09.metaAmended", { p, prm, d: latest.decision ?? t("cer.decisionUnknown"), ts: timestamp(latest.at, locale) });
  if (latest.status === "SUSPENDED" && latest.ground === "GR-PAYMENT-REVERSED") return t("cer09.metaSuspended", { p, prm, ts: timestamp(latest.at, locale) });
  return t("cer09.metaStatus", { p, prm, s: t(`cer.status.${latest.status}`), ts: timestamp(latest.at, locale) });
}

function authority(value: ChangeAuthority, policyVersion: string | null, t: Translate, locale: Locale): { text: string; detail?: string; plain: true } {
  switch (value.kind) {
    case "ROUTE": {
      // FR-CER-023: the rule at its default and the decision that required the issue.
      const detail = [value.straight ? t("cer09.straight") : null, value.decision !== undefined && value.decision !== null ? t("cer09.byDecision", { d: value.decision }) : null].filter((part) => part !== null).join(" ");
      return detail !== "" ? { text: t("cer09.route"), detail, plain: true } : { text: t("cer09.route"), plain: true };
    }
    case "APPROVAL":
      return { text: t("cer09.approvedBy", { a: value.approver }), plain: true };
    case "REVIEW":
      return {
        text: t("cer09.byPair", { p: value.proposer, a: value.approver }),
        detail: policyVersion !== null ? t("cer09.pairDetailVersion", { r: value.review, v: policyVersion }) : t("cer09.pairDetail", { r: value.review }),
        plain: true,
      };
    case "SUCCESSOR":
      return { text: t("cer09.successor", { r: value.successor }), plain: true };
    case "NOTICE":
      // DR-434: the expiry notice COM raised and the instant it fell due, or the fallback where COM gave none in time.
      return value.fallback || value.notice === null
        ? { text: t("cer09.expiryFallback"), plain: true }
        : { text: t("cer09.expiryNotice", { n: value.notice }), ...(value.dueAt !== null ? { detail: t("cer09.noticeDue", { ts: timestamp(value.dueAt, locale) }) } : {}), plain: true };
    case "PERIOD":
      return { text: t("cer09.periodRule"), ...(value.decision !== null ? { detail: t("cer09.byDecision", { d: value.decision }) } : {}), plain: true };
  }
}

function History({ data, t, locale }: { data: RecordHistory | null; t: Translate; locale: Locale }) {
  const loading = data === null;
  const followUps = data?.followUps ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      <Panel title={t("cer09.periods")} description={t("cer09.periodsDesc")} level={2} compact locale={locale}>
        <Table
          columns={[
            { key: "decision", label: t("cer09.cDecision"), kind: "id", missing: t("cer.decisionUnknown") },
            { key: "from", label: t("cer09.cFrom"), kind: "stack", unit: "GMT+7", nowrap: true, missing: t("cer09.notYet") },
            { key: "to", label: t("cer09.cTo"), kind: "stack", unit: "GMT+7", nowrap: true, missing: t("cer09.notYet") },
            { key: "cause", label: t("cer09.cCause"), kind: "stack" },
          ]}
          rows={(data?.periods ?? []).map((period, index) => ({
            _key: `p${String(index)}`,
            ...(period.decision !== null ? { decision: period.decision } : {}),
            ...(period.from !== null ? { from: cell(period.from, locale) } : {}),
            // The period in force reads Still governs; a pending record has no period yet (SM-03).
            ...(period.to !== null ? { to: cell(period.to, locale) } : period.from !== null ? { to: { text: t("cer09.stillGoverns"), plain: true, muted: true } } : {}),
            // A renewal names the decision it renews and the period before it, which it left as it was (FR-CER-024).
            cause:
              period.follows !== null
                ? {
                    text: t(`cer09.cause.${period.cause}`),
                    detail:
                      period.follows.from !== ""
                        ? t("cer09.follows", { d: period.follows.decision ?? t("cer.decisionUnknown"), p: formatPeriod(period.follows.from, period.follows.to, locale) })
                        : t("cer09.renews", { d: period.follows.decision ?? t("cer.decisionUnknown") }),
                    plain: true,
                  }
                : { text: t(`cer09.cause.${period.cause}`), plain: true },
          }))}
          loading={loading ? 1 : false}
          density="console"
          caption={t("cer09.periods")}
          locale={locale}
        />
      </Panel>
      <Panel title={t("cer09.changes")} level={2} compact locale={locale}>
        <Table
          columns={[
            { key: "was", label: t("cer09.cWas"), kind: "status" },
            { key: "became", label: t("cer09.cBecame"), kind: "status" },
            { key: "eff", label: t("cer09.cEffective"), kind: "stack", unit: "GMT+7", nowrap: true },
            { key: "rec", label: t("cer09.cRecorded"), kind: "stack", unit: "GMT+7", nowrap: true },
            { key: "auth", label: t("cer09.cAuthority"), kind: "stack", minWidth: "var(--space-40)" },
            { key: "ground", label: t("cer09.cGround"), kind: "stack", missing: t("cer09.noGround") },
          ]}
          rows={(data?.changes ?? []).map((change, index) => ({
            _key: `c${String(index)}`,
            was: recordStatus(t, change.from),
            became: recordStatus(t, change.to),
            eff: cell(change.effectiveAt, locale),
            rec: cell(change.recordedAt, locale),
            auth: authority(change.authority, change.policyVersion, t, locale),
            ...(change.ground !== null
              ? {
                  ground: {
                    text: t(`cer.ground.${change.ground}`),
                    detail: [
                      ...(change.evidence.length > 0 ? [t("cer09.groundEvidence", { e: change.evidence.join(", ") })] : []),
                      ...(change.condition !== null ? [t("cer09.groundCondition", { c: t(`cer.reinstateLower.${change.condition}`) })] : []),
                    ].join(" "),
                    plain: true,
                  },
                }
              : {}),
          }))}
          loading={loading ? 2 : false}
          density="console"
          {...(!loading ? { sortNote: t("cer09.changeNote") } : {})}
          empty={{ variant: "not-started", title: t("cer09.noChanges"), action: false }}
          caption={t("cer09.changes")}
          locale={locale}
        />
      </Panel>
      {followUps.length > 0 && (
        // A record with no follow-up has no table: an empty one states no fact about the record.
        <Panel title={t("cer09.followUps")} level={2} compact locale={locale}>
          <Table
            columns={[
              { key: "id", label: t("cer09.cFollow"), kind: "id" },
              { key: "decision", label: t("cer09.cNewDecision"), kind: "id", missing: t("cer.decisionUnknown") },
              { key: "due", label: t("cer09.cDue"), kind: "stack", unit: "GMT+7", nowrap: true },
              { key: "applied", label: t("cer09.cApplied"), kind: "stack", unit: "GMT+7", nowrap: true, missing: t("cer09.notApplied") },
              { key: "late", label: t("cer09.cLate"), nowrap: true },
              { key: "outcome", label: t("cer09.cOutcome") },
            ]}
            rows={followUps.map((followUp) => ({
              _key: followUp.reference,
              id: followUp.reference,
              ...(followUp.decision !== null ? { decision: followUp.decision } : {}),
              due: cell(followUp.dueBy, locale),
              ...(followUp.appliedAt !== null ? { applied: cell(followUp.appliedAt, locale) } : {}),
              late: followUp.lateMs === null ? t("cer09.notApplied") : followUp.lateMs > 0 ? duration(t, followUp.lateMs, locale) : t("cer09.onTime"),
              outcome: followUp.outcome !== null ? t(`cer.outcomeDone.${followUp.outcome}`) : t("cer09.notApplied"),
              ...(followUp.why !== null ? { _message: { severity: "neutral", text: written(followUp.why, locale) ?? "" } } : {}),
            }))}
            density="console"
            caption={t("cer09.followUps")}
            locale={locale}
          />
        </Panel>
      )}
      {data !== null && (
        <ButtonRow align="between">
          <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsStatusRecords()} locale={locale}>
            {t("cer09.backList")}
          </Button>
          <Button variant="secondary" size="sm" href={routes.opsStatusRecord(data.key)} locale={locale}>
            {t("cer09.openRecord")}
          </Button>
        </ButtonRow>
      )}
    </div>
  );
}

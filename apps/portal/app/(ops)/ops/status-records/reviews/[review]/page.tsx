import {
  ApprovalPair,
  Banner,
  Button,
  Columns,
  Divider,
  FactList,
  PageHeader,
  Panel,
  Skeleton,
  TextField,
  Toast,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { decideReviewAction } from "@/features/status-records/actions";
import { ConsoleFailure } from "@/features/status-records/console";
import { DecisionControls } from "@/features/status-records/DecisionControls";
import { date, recordStatus, reviewStatus, timestamp, written } from "@/features/status-records/words";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { loadReviewPage, type ReviewAttempt, type ReviewPage } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER06_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "cer06-decision";

/** The refusals of a decision drawn in place of the controls, in the catalogue's words. */
const IN_PLACE: Readonly<Record<string, string>> = {
  STATUS_CHANGED_SINCE_PROPOSAL: "cer.refusal.STATUS_CHANGED_SINCE_PROPOSAL",
  REVIEW_NOT_PROPOSED: "cer.refusal.REVIEW_NOT_PROPOSED",
  NO_ENFORCEMENT_POLICY: "cer.refusal.NO_ENFORCEMENT_POLICY",
  GROUND_NOT_IN_POLICY: "cer.refusal.GROUND_NOT_IN_POLICY",
  GROUND_NOT_FOR_ACTION: "cer.refusal.GROUND_NOT_FOR_ACTION",
  REINSTATEMENT_CONDITIONS_NOT_MET: "cer.refusal.REINSTATEMENT_CONDITIONS_NOT_MET",
  PAYMENT_READ_UNAVAILABLE: "cer.refusal.PAYMENT_READ_UNAVAILABLE",
  NOT_AUTHORISED: "cer.refusal.NOT_AUTHORISED",
  SEGREGATION_REQUIRED: "cer.refusal.SEGREGATION_REQUIRED",
};

/**
 * SCR-CER-06 Decide a status change. The business approver reads the proposal and everything an approval records:
 * the status from then and when it takes effect, the condition that reinstates it, the remedy with its closing date,
 * the notice to the premises and the rule. Approve asks first, in the danger family for a suspension, revocation or
 * cancellation; Decline returns the review open. The officer who proposed reads the review waiting for another
 * approver and has no decision control (finding F-3); the server refuses a proposer the decision either way.
 */
export default async function DecideReviewPage({ params, searchParams }: { params: Promise<{ review: string }>; searchParams: Promise<SearchParams> }) {
  // The approver decides; the officer and the auditor read.
  const staff = await requireStaff("ACT-BIZ-APR", "ACT-OPS", "ACT-AUD");
  const [{ review }, query] = await Promise.all([params, searchParams]);
  const ref = decodeURIComponent(review);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, CER06_VIEWS);
  const kept = view === null ? readForPage<ReviewAttempt>(query) : null;
  const attempt = kept?.review === ref ? kept : null;
  const actor = { name: staff.account, position: staff.position, roles: staff.roles };
  const outcome = view === "loading" ? null : await loadReviewPage(staff.sessionId, actor, ref, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="records" staff={staff} searchLabel={t("cer.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("cer06.crumb"), href: routes.opsStatusRecords() },
            { label: t("cer06.reviews"), href: routes.opsStatusReviews() },
          ]}
          title={data !== null ? t("cer06.titleTpl", { r: data.reference }) : t("cer06.titlePlain")}
          {...(data !== null
            ? {
                status: reviewStatus(t, data.state),
                meta: data.record.reference !== null ? t("cer06.meta", { p: data.record.premises, r: data.record.reference }) : data.record.premises,
              }
            : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Columns side="md">
            <Panel title={t("cer06.proposal")} locale={locale}>
              <Skeleton variant="facts" rows={8} density="console" locale={locale} />
            </Panel>
            <Panel title={t("cer06.decision")} locale={locale}>
              <Skeleton variant="card" rows={4} density="console" locale={locale} />
            </Panel>
          </Columns>
        ) : failure !== null || data === null ? (
          failure !== null && (
            <ConsoleFailure
              failure={failure}
              refusals={{
                REVIEW_NOT_FOUND: { title: "cer06.nfTitle", text: "cer.refusal.REVIEW_NOT_FOUND" },
                POLICY_READ_UNAVAILABLE: { title: "cer06.pdTitle", text: "cer.refusal.POLICY_READ_UNAVAILABLE", retry: routes.opsStatusReview(ref) },
              }}
              back={failure.code === "REVIEW_NOT_FOUND" ? { label: t("cer06.back"), href: routes.opsStatusReviews() } : null}
              t={t}
              locale={locale}
            />
          )
        ) : (
          <Deciding data={data} staff={staff} attempt={attempt} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Deciding({ data, staff, attempt, t, locale }: { data: ReviewPage; staff: Staff; attempt: ReviewAttempt | null; t: Translate; locale: Locale }) {
  const proposal = data.proposal;
  const decision = data.decision;
  const recorded = data.recorded;
  const approver = holds(staff, "ACT-BIZ-APR");
  const done = attempt?.done ?? null;
  const act = proposal?.act ?? "NO_CHANGE";
  const takesEffect = recorded?.takesEffect ?? null;

  const proposalFacts =
    proposal === null
      ? [
          { label: t("cer06.fRecord"), value: data.record.reference, kind: "id" as const, missing: t("cer06.notIssued") },
          raised(data, t, locale),
          { label: t("cer06.fOpened"), value: data.openedAt, kind: "datetime" as const },
          { label: t("cer06.fProposal"), value: t("cer06.noProposal") },
        ]
      : [
          { label: t("cer06.fAct"), value: t(`cer.actFull.${proposal.act}`) },
          { label: t("cer06.fRecord"), value: data.record.reference, kind: "id" as const, missing: t("cer06.notIssued") },
          { label: t("cer06.fStatusThen"), value: recordStatus(t, proposal.statusWhenProposed), kind: "status" as const },
          ...(proposal.ground !== null ? [{ label: t("cer06.fGround"), value: t(`cer.ground.${proposal.ground}`) }] : []),
          { label: t("cer06.fReason"), value: written(proposal.reason, locale), missing: t("cer06.noReason") },
          proposal.evidence.length > 0
            ? { label: t("cer06.fEvidence"), value: proposal.evidence.join(", "), kind: "mono" as const }
            : { label: t("cer06.fEvidence"), value: null, missing: t("cer06.noEvidence") },
          ...proposal.conditionsAddressed.map((entry) => ({ label: t("cer06.fConditions"), value: entry.howMet, note: t(`cer.reinstate.${entry.condition}`) })),
        ];

  const showRecorded = proposal !== null && recorded !== null && !(decision?.outcome === "DECLINE");
  const recordedFacts =
    recorded === null
      ? []
      : [
          recorded.status !== null
            ? {
                label: t("cer06.fNewStatus"),
                value: recordStatus(t, recorded.status),
                kind: "status" as const,
                ...(data.state === "APPROVED" && Date.parse(recorded.takesEffect) > Date.now() ? { note: t("cer06.activeUntil") } : {}),
              }
            : { label: t("cer06.fNewStatus"), value: t("cer06.unchanged") },
          { label: t("cer06.fEffective"), value: recorded.takesEffect, kind: "datetime" as const },
          ...(recorded.condition !== null ? [{ label: t("cer06.fCondition"), value: t(`cer.reinstate.${recorded.condition}`) }] : []),
          recorded.appealBy !== null
            ? { label: t("cer06.fRemedy"), value: t("cer06.remedy"), note: t("cer06.remedyNote", { d: date(recorded.appealBy, locale) }) }
            : { label: t("cer06.fRemedy"), value: t("cer06.remedyDefault") },
          { label: t("cer06.fNotice"), value: t(!recorded.notice ? "cer06.noticeNone" : (proposal?.ground !== undefined && proposal?.ground !== null) ? "cer06.notice" : "cer06.noticePlain") },
          ...((proposal?.ground !== undefined && proposal?.ground !== null) ? [{ label: t("cer06.fRule"), value: t("cer06.rule"), note: t("cer06.ruleNote") }] : []),
        ];

  const toast =
    done === "approved" && data.state === "APPROVED"
      ? {
          family: "positive" as const,
          title: t(`cer06.okTitle.${act}`, { ts: takesEffect !== null ? timestamp(takesEffect, locale) : "" }),
          text: t(act === "NO_CHANGE" ? "cer06.okTextNone" : "cer06.okText"),
        }
      : done === "declined"
        ? { family: "neutral" as const, title: t("cer06.noTitle"), text: t("cer06.noText") }
        : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      {toast !== null && (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family={toast.family} title={toast.title} locale={locale}>
            {toast.text}
          </Toast>
        </div>
      )}
      <Columns side="md">
        <Panel title={proposal !== null ? t("cer06.proposal") : t("cer06.proposalNone")} gap="xl" locale={locale}>
          <FactList items={proposalFacts} density="console" locale={locale} />
          {showRecorded && (
            <>
              <Divider />
              <Panel variant="plain" level={3} title={t(data.state === "APPROVED" ? "cer06.recordedDone" : "cer06.recordedTitle")} compact locale={locale}>
                <FactList items={recordedFacts} density="console" locale={locale} />
              </Panel>
            </>
          )}
        </Panel>
        <Panel title={t("cer06.decision")} gap="lg" locale={locale}>
          <DecisionPanel data={data} approver={approver} attempt={attempt} t={t} locale={locale} />
        </Panel>
      </Columns>
    </div>
  );
}

function raised(data: ReviewPage, t: Translate, locale: Locale) {
  const trigger = data.trigger;
  if (trigger.kind === "CASE") {
    return {
      label: t("cer06.fRaised"),
      value: t("cer06.caseWord", { c: trigger.caseRef }),
      ...(trigger.letter !== null && trigger.letterOn !== null ? { note: t("cer06.caseNote", { l: trigger.letter, d: date(trigger.letterOn, locale) }) } : {}),
    };
  }
  if (trigger.kind === "PAYMENT_REVERSAL") return { label: t("cer06.fRaised"), value: t("cer06.reversalWord", { ts: timestamp(trigger.at, locale) }), note: trigger.event };
  return { label: t("cer06.fRaised"), value: t("cer06.officerWord") };
}

/** Who proposed and who decides, and the decision itself where the reader may take it. */
function DecisionPanel({ data, approver, attempt, t, locale }: { data: ReviewPage; approver: boolean; attempt: ReviewAttempt | null; t: Translate; locale: Locale }) {
  const proposal = data.proposal;
  const decision = data.decision;
  const recorded = data.recorded;
  const refusal = attempt?.refusal ?? null;
  const back = (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <Button variant="secondary" size="sm" href={routes.opsStatusReviews()} locale={locale}>
        {t("cer06.back")}
      </Button>
    </div>
  );

  if (proposal === null || (data.state === "OPEN" && decision === null)) {
    // An open review has nothing to decide: the board's REVIEW_NOT_PROPOSED in place of the decision.
    return (
      <Banner
        family="attention"
        title={t("cer06.nopTitle")}
        code="REVIEW_NOT_PROPOSED"
        action={{ label: t("cer06.back"), href: routes.opsStatusReviews(), variant: "secondary" }}
        density="console"
        locale={locale}
      >
        {t("cer.refusal.REVIEW_NOT_PROPOSED")}
      </Banner>
    );
  }

  const proposer = { name: proposal.proposer.name, role: proposal.proposer.position, at: proposal.proposer.at };
  const decided = decision !== null && (data.state === "APPROVED" || data.state === "OPEN");
  const pair = (
    <ApprovalPair
      preparer={proposer}
      approver={decided ? { name: decision.by.name, role: decision.by.position, at: decision.by.at } : null}
      {...(!decided ? { awaiting: approver && !data.readerProposed ? t("cer06.waitYou") : t("cer06.waitOther") } : {})}
      {...(decided ? { decision: decision.outcome === "APPROVE" ? ("approved" as const) : ("declined" as const) } : {})}
      {...(decided && decision.reason !== null ? { comment: written(decision.reason, locale) ?? "" } : {})}
      // The reader proposed it and holds the approver's role too: the two-person rule, said where the decision would be.
      {...(data.readerProposed && approver
        ? { sameActor: { code: "SEGREGATION_REQUIRED", title: t("cer06.refusedTitle"), text: t("cer.refusal.SEGREGATION_REQUIRED"), family: "danger" as const } }
        : {})}
      preparerLabel={t("cer06.proposerLabel")}
      approverLabel={t("cer06.approverLabel")}
      locale={locale}
    />
  );

  const deciding = approver && !data.readerProposed && data.state === "PROPOSED" && (attempt?.done === undefined || attempt?.done === null);
  if (!deciding) {
    return (
      <>
        {pair}
        {refusal !== null && (
          <Banner family="attention" title={t("cer06.refusedTitle")} code={refusal} density="console" live locale={locale}>
            {t(IN_PLACE[refusal] ?? "cer.refusal.NOT_AUTHORISED")}
          </Banner>
        )}
        {back}
      </>
    );
  }

  // STATUS_CHANGED_SINCE_PROPOSAL replaces the decision with Reload the review; every other refusal sits above it.
  if (refusal === "STATUS_CHANGED_SINCE_PROPOSAL") {
    return (
      <>
        {pair}
        <Banner
          family="attention"
          title={t("cer06.refusedTitle")}
          code={refusal}
          action={{ label: t("cer06.reloadReview"), icon: "refresh-cw", variant: "secondary", href: routes.opsStatusReview(data.reference) }}
          density="console"
          live
          locale={locale}
        >
          {t("cer.refusal.STATUS_CHANGED_SINCE_PROPOSAL")}
        </Banner>
      </>
    );
  }

  const act = proposal.act;
  const destructive = act === "SUSPEND" || act === "REVOKE" || act === "CANCEL";
  const takesEffect = recorded?.takesEffect ?? new Date().toISOString();
  const reference = data.record.reference ?? data.record.premises;
  return (
    <>
      {pair}
      {refusal !== null && refusal !== "REASON_REQUIRED" && (
        <Banner family="attention" title={t("cer06.refusedTitle")} code={refusal} compact density="console" live locale={locale}>
          {t(IN_PLACE[refusal] ?? "cer.refusal.NOT_AUTHORISED")}
        </Banner>
      )}
      <form id={FORM} action={decideReviewAction} noValidate style={{ display: "contents" }}>
        <input type="hidden" name="review" value={data.reference} />
        <TextField
          label={t("cer06.reason")}
          helper={t("cer06.reasonHelp")}
          name="reason"
          value={attempt?.values.reason ?? ""}
          {...(refusal === "REASON_REQUIRED" ? { error: t("cer.refusal.REASON_REQUIRED") } : {})}
          wrap
          maxLength={2000}
          width="100%"
          density="console"
          locale={locale}
        />
        <DecisionControls
          formId={FORM}
          approve={{ label: t(`cer06.approve.${act}`) }}
          decline={{ label: t("cer06.decline"), variant: "secondary" }}
          back={{ label: t("cer06.back"), href: routes.opsStatusReviews(), variant: "secondary" }}
          dialog={{
            title: t(`cer06.dlgTitle.${act}`, { r: reference, ts: timestamp(takesEffect, locale) }),
            description: t(`cer06.dlgText.${act}`, { p: data.record.premises }),
            yes: { label: t(`cer.actFull.${act}`), variant: destructive ? "danger" : "primary" },
            cancel: t("cer06.dlgBack"),
            facts: [
              ...(proposal.ground !== null ? [{ label: t("cer06.fGround"), value: t(`cer.ground.${proposal.ground}`) }] : []),
              ...((recorded?.condition !== undefined && recorded?.condition !== null) ? [{ label: t("cer06.fCondition"), value: t(`cer.reinstate.${recorded.condition}`) }] : []),
              ...((recorded?.appealBy !== undefined && recorded?.appealBy !== null) ? [{ label: t("cer06.fRemedy"), value: `${t("cer06.remedy")}. ${t("cer06.remedyNote", { d: date(recorded.appealBy, locale) })}` }] : []),
            ],
            typed: [{ name: "reason", label: t("cer06.fYourReason"), none: t("cer06.noYourReason") }],
          }}
          label={t("cer06.decision")}
          locale={locale}
        />
      </form>
    </>
  );
}

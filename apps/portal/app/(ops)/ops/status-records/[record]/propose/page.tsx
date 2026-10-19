import { ApprovalPair, Banner, Button, FactList, PageHeader, Panel, Skeleton, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { proposeChangeAction } from "@/features/status-records/actions";
import { ConsoleFailure } from "@/features/status-records/console";
import { ProposalFields } from "@/features/status-records/ProposalFields";
import { date, feeNote, recordStatus, reviewStatus, timestamp, written } from "@/features/status-records/words";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { loadProposalPage, type Proposal, type ProposalAttempt, type ProposalField, type ProposalPage, type StatusAct } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER05_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** Each refusal of a proposal drawn below the field it names, in the catalogue's words. */
const FIELD_ERRORS: Readonly<Record<string, string>> = {
  ACTION_NOT_PERMITTED_FROM_STATUS: "cer05.eAct",
  GROUND_REQUIRED: "cer05.eGroundReq",
  GROUND_NOT_IN_POLICY: "cer.refusal.GROUND_NOT_IN_POLICY",
  GROUND_NOT_FOR_ACTION: "cer.refusal.GROUND_NOT_FOR_ACTION",
  REASON_REQUIRED: "cer05.eReason",
  EVIDENCE_REQUIRED: "cer05.eEvidence",
  EFFECTIVE_TIME_IN_PAST: "cer05.eTime",
  REINSTATEMENT_CONDITIONS_NOT_ADDRESSED: "cer05.eConditions",
};

/** Refusals of the whole proposal, said above the form. */
const PAGE_REFUSALS: Readonly<Record<string, string>> = {
  REVIEW_NOT_OPEN: "cer.refusal.REVIEW_NOT_OPEN",
  REVIEW_NOT_FOUND: "cer.refusal.REVIEW_NOT_FOUND",
  CERTIFICATE_UNKNOWN: "cer.refusal.CERTIFICATE_UNKNOWN",
  NO_ENFORCEMENT_POLICY: "cer.refusal.NO_ENFORCEMENT_POLICY",
  NOT_AUTHORISED: "cer.refusal.NOT_AUTHORISED",
};

/**
 * SCR-CER-05 Propose a status change. The operations officer proposes one act on a record, no change or one SM-03
 * permits from its status, with the ground the policy in force gives for it, a reason the premises reads once the
 * change is decided, the evidence and when it takes effect. On a review an event opened the proposal joins it;
 * otherwise it opens one. Recorded, it waits for a business approver who did not propose it.
 */
export default async function ProposeChangePage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  // Only an operations officer proposes.
  const staff = await requireStaff("ACT-OPS");
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const key = decodeURIComponent(record);
  const review = typeof query.review === "string" && query.review !== "" ? query.review : null;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, CER05_VIEWS);
  const kept = view === null ? readForPage<ProposalAttempt>(query) : null;
  const attempt = kept?.record === key ? kept : null;
  const outcome = view === "loading" ? null : await loadProposalPage(staff.sessionId, key, review, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const recordKey = data?.record.key ?? key;

  return (
    <OpsFrame console="operations" current="records" staff={staff} searchLabel={t("cer.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("cer05.crumb"), href: routes.opsStatusRecords() },
            ...((data?.record.reference !== undefined && data?.record.reference !== null) ? [{ label: data.record.reference, href: routes.opsStatusRecord(recordKey) }] : []),
          ]}
          title={
            data === null
              ? t("cer05.titlePlain")
              : data.record.reference !== null
                ? t("cer05.titleTpl", { r: data.record.reference })
                : t("cer05.titlePending", { p: data.record.premises })
          }
          {...(data !== null ? { status: recordStatus(t, data.record.status), meta: data.record.premises } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
            <Panel title={t("cer05.ctxTitle")} compact locale={locale}>
              <Skeleton variant="facts" rows={2} density="console" locale={locale} />
            </Panel>
            <Panel title={t("cer05.formTitle")} locale={locale}>
              <Skeleton variant="card" rows={6} density="console" locale={locale} />
            </Panel>
          </div>
        ) : failure !== null || data === null ? (
          failure !== null && (
            <ConsoleFailure
              failure={failure}
              refusals={{
                CERTIFICATE_NOT_FOUND: { title: "cer02.nfTitle", text: "cer.refusal.CERTIFICATE_NOT_FOUND" },
                REVIEW_NOT_FOUND: { title: "cer06.nfTitle", text: "cer.refusal.REVIEW_NOT_FOUND" },
              }}
              back={{ label: t("cer05.leave"), href: routes.opsStatusRecord(key) }}
              t={t}
              locale={locale}
            />
          )
        ) : (
          <Proposing data={data} attempt={attempt} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Proposing({ data, attempt, t, locale }: { data: ProposalPage; attempt: ProposalAttempt | null; t: Translate; locale: Locale }) {
  const review = data.review;
  // A review that waits for an approver takes no other proposal: the page shows the one recorded on it.
  const recorded = review !== null && review.state === "PROPOSED" && review.proposal !== null ? review.proposal : null;
  const refusal = attempt?.refusal ?? null;
  const pageRefusal = refusal !== null && refusal.field === null && refusal.code !== "REVIEW_ALREADY_OPEN" ? refusal.code : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      {(attempt?.proposed !== undefined && attempt?.proposed !== null) && recorded !== null && (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t("cer05.toastTitle")} locale={locale} />
        </div>
      )}
      {refusal?.code === "REVIEW_ALREADY_OPEN" && refusal.openReview !== null && (
        <Banner
          family="attention"
          title={t("cer05.roTitle")}
          code={refusal.code}
          action={{
            label: t("cer05.openReview", { r: refusal.openReview }),
            variant: "secondary",
            href:
              data.openReview?.state === "OPEN"
                ? routes.opsStatusRecordProposal(data.record.key, refusal.openReview)
                : routes.opsStatusReview(refusal.openReview),
          }}
          density="console"
          locale={locale}
        >
          {t("cer05.roText")}
        </Banner>
      )}
      {pageRefusal !== null && (
        <Banner family="attention" title={t("cer05.refusedTitle")} code={pageRefusal} density="console" locale={locale}>
          {t(PAGE_REFUSALS[pageRefusal] ?? "cer.refusal.NOT_AUTHORISED")}
        </Banner>
      )}
      <Panel title={t("cer05.ctxTitle")} compact locale={locale}>
        <FactList items={context(data, t, locale)} columns={2} density="console" locale={locale} />
      </Panel>
      {recorded !== null ? (
        <RecordedProposal proposal={recorded} t={t} locale={locale} />
      ) : (
        <Panel title={t("cer05.formTitle")} gap="lg" locale={locale}>
          <form action={proposeChangeAction} noValidate style={{ display: "contents" }}>
            <input type="hidden" name="record" value={data.record.key} />
            <input type="hidden" name="review" value={review?.reference ?? ""} />
            <ProposalFields {...fieldsOf(data, attempt, t, locale)} />
          </form>
        </Panel>
      )}
    </div>
  );
}

/** The record and its review: the period, the review joined or opened, and the fact behind it. */
function context(data: ProposalPage, t: Translate, locale: Locale) {
  const review = data.review;
  const trigger = review?.trigger ?? null;
  const reviewNote =
    review === null || trigger === null
      ? null
      : trigger.kind === "PAYMENT_REVERSAL"
        ? t("cer05.reviewNotePay", { at: timestamp(review.openedAt, locale) })
        : trigger.kind === "CASE"
          ? trigger.letter !== null
            ? t("cer05.reviewNoteCase", { at: timestamp(review.openedAt, locale), c: trigger.caseRef, l: trigger.letter })
            : t("cer05.reviewNoteCasePlain", { at: timestamp(review.openedAt, locale), c: trigger.caseRef })
          : t("cer05.reviewNoteOfficer", { at: timestamp(review.openedAt, locale) });
  const fee = data.record.fee;
  // The fact behind a reversed payment: when the fee was paid and when the cardholder took it back.
  const reversal = trigger?.kind === "PAYMENT_REVERSAL" ? trigger : data.openReview?.trigger.kind === "PAYMENT_REVERSAL" ? data.openReview.trigger : null;
  const feeFact =
    fee === null
      ? []
      : reversal !== null && fee.paid !== null
        ? [
            {
              label: t("cer05.fFee"),
              value: { amountMinor: fee.amountMinor, currency: "VND" },
              kind: "money" as const,
              note: t("cer05.feeNote", { paid: date(fee.paid.at, locale), rev: timestamp(reversal.at, locale), e: reversal.event }),
            },
          ]
        : [{ label: t("cer05.fFee"), value: feeNote(fee, t, locale) }];
  return [
    ...(data.record.period !== null ? [{ label: t("cer05.fPeriod"), value: data.record.period, kind: "period" as const }] : []),
    review !== null
      ? { label: t("cer05.fReview"), value: review.reference, kind: "id" as const, ...(reviewNote !== null ? { note: reviewNote } : {}) }
      : { label: t("cer05.fReview"), value: t("cer05.newReview") },
    ...(data.record.closing !== null
      ? [{ label: t("cer05.fChange"), value: t("cer05.closes", { d: date(data.record.closing.on, locale) }), note: t("cer05.closesNote", { at: timestamp(data.record.closing.recordedAt, locale) }) }]
      : []),
    ...(data.record.successor !== null
      ? [{ label: t("cer05.fReplaced"), value: data.record.successor.reference, kind: "id" as const, note: t("cer05.replacedNote", { at: timestamp(data.record.successor.since, locale) }) }]
      : feeFact),
  ];
}

function fieldsOf(data: ProposalPage, attempt: ProposalAttempt | null, t: Translate, locale: Locale) {
  const refusal = attempt?.refusal ?? null;
  const field: ProposalField | null = refusal?.field ?? null;
  const errorKey = refusal !== null ? FIELD_ERRORS[refusal.code] : undefined;
  const errors = field !== null && errorKey !== undefined ? { [field]: t(errorKey) } : {};
  const firstAct: StatusAct = data.acts[0] ?? "NO_CHANGE";
  const values = attempt?.values ?? { act: firstAct, ground: "", reason: "", evidence: "", effective: "", conditions: {} };
  const policy = data.policy;
  return {
    acts: data.acts.map((act) => ({ value: act, label: t(`cer.act.${act}`) })),
    grounds:
      policy === null
        ? null
        : policy.grounds.map((ground) => ({
            value: ground.code,
            label: t(`cer.ground.${ground.code}`),
            acts: ground.acts,
            condition: ground.condition !== null ? t(`cer.reinstateWhen.${ground.condition}`) : null,
          })),
    groundNotice: data.policyUnreadable ? (
      <Banner
        family="attention"
        title={t("cer05.pdTitle")}
        code="POLICY_READ_UNAVAILABLE"
        action={{ label: t("cer05.tryAgain"), icon: "refresh-cw", variant: "secondary", href: routes.opsStatusRecordProposal(data.record.key, data.review?.reference) }}
        density="console"
        locale={locale}
      >
        {t("cer.refusal.POLICY_READ_UNAVAILABLE")}
      </Banner>
    ) : policy === null ? (
      <Banner family="neutral" title={t("cer05.npTitle")} code="NO_ENFORCEMENT_POLICY" density="console" locale={locale}>
        {t("cer.refusal.NO_ENFORCEMENT_POLICY")}
      </Banner>
    ) : null,
    conditions: data.conditions.map((condition) => ({ code: condition, label: t(`cer.reinstate.${condition}`) })),
    values: { ...values, act: data.acts.includes(values.act) ? values.act : firstAct },
    errors,
    blocked: data.policyUnreadable ? t("cer05.whyPolicy") : null,
    leaveHref: routes.opsStatusRecord(data.record.key),
    words: {
      act: t("cer05.act"),
      ground: t("cer05.ground"),
      groundPh: t("cer05.groundPh"),
      reason: t("cer05.reason"),
      reasonHelp: t("cer05.reasonHelp"),
      evidence: t("cer05.evidence"),
      evidenceHelp: t("cer05.evidenceHelp"),
      evidenceOptional: t("cer05.evidenceOptional"),
      effective: t("cer05.effective"),
      effectiveHelp: t("cer05.effectiveHelp"),
      condHelp: t("cer05.condHelp"),
      propose: t("cer05.propose"),
      leave: t("cer05.leave"),
      whyGround: t("cer05.whyGround"),
      whyEvidence: t("cer05.whyEvidence"),
      whyReason: t("cer05.whyReason"),
      whyConditions: t("cer05.whyConditions"),
      whyNoAct: t("cer05.whyNoAct"),
    },
    locale,
  };
}

/** A proposal recorded: the act, the ground, the condition, when it takes effect, the reason and the evidence, waiting for an approver. */
function RecordedProposal({ proposal, t, locale }: { proposal: Proposal; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("cer05.recordedTitle")} status={reviewStatus(t, "PROPOSED")} gap="lg" locale={locale}>
      <FactList
        items={[
          { label: t("cer05.fAct"), value: t(`cer.act.${proposal.act}`) },
          ...(proposal.ground !== null ? [{ label: t("cer05.fGround"), value: t(`cer.ground.${proposal.ground}`), note: t("cer02.policyVal") }] : []),
          ...(proposal.condition !== null && proposal.act === "SUSPEND" ? [{ label: t("cer05.fCondition"), value: t(`cer.reinstate.${proposal.condition}`) }] : []),
          proposal.effectiveAt !== null
            ? { label: t("cer05.fEffective"), value: proposal.effectiveAt, kind: "datetime" as const }
            : { label: t("cer05.fEffective"), value: t("cer05.whenApproved") },
          { label: t("cer05.fReason"), value: written(proposal.reason, locale) },
          proposal.evidence.length > 0
            ? { label: t("cer05.fEvidence"), value: proposal.evidence.join(", "), kind: "mono" as const }
            : { label: t("cer05.fEvidence"), value: null, missing: t("cer05.noEvidence") },
        ]}
        columns={2}
        density="console"
        locale={locale}
      />
      <ApprovalPair
        preparer={{ name: proposal.proposer.name, role: proposal.proposer.position, at: proposal.proposer.at }}
        approver={null}
        awaiting={t("cer05.awaiting")}
        preparerLabel={t("cer05.proposerLabel")}
        approverLabel={t("cer05.approverLabel")}
        locale={locale}
      />
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <Button variant="secondary" size="sm" href={routes.opsStatusReviews()} locale={locale}>
          {t("cer05.backReviews")}
        </Button>
      </div>
    </Panel>
  );
}

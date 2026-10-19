import { ApprovalPair, Banner, Button, ButtonRow, Disclosure, Divider, FactList, ItemList, PageHeader, Panel, Skeleton, Table, Toast } from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { assessStatusRecord, printFromConsole } from "@/features/status-records/actions";
import { ConsoleFailure } from "@/features/status-records/console";
import { feeNote, recordStatus, reviewStatus, timestamp, date, written } from "@/features/status-records/words";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { applicationOfDecision } from "@/lib/api/premises";
import { loadConsoleRecord, type ConsoleRecord, type LastChange, type OpenReview, type RecordAttempt } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER02_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type Fact = { label: string; value: unknown; kind?: "id" | "status" | "period" | "datetime" | "mono" | "link"; note?: string; missing?: string };

/**
 * SCR-CER-02 Status record. One record as the officer needs it: its status now and since when, the premises, holder,
 * period and decision with its fee, how it was issued and what it replaces or was replaced by, the wording copied at
 * issue, its open review and proposal (finding F-2), the last change with its ground and remedy, the assessment while
 * it waits to issue, and its printouts. Assess again, Print and Propose a change are the officer's; History the
 * officer's and the auditor's.
 */
export default async function ConsoleRecordPage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  // The officer, the approver, the legal authority and the auditor read here.
  const staff = await requireStaff("ACT-OPS", "ACT-BIZ-APR", "ACT-LGL", "ACT-AUD");
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const key = decodeURIComponent(record);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, CER02_VIEWS);
  const attempt = view === null ? readForPage<RecordAttempt>(query) : null;
  const outcome = view === "loading" ? null : await loadConsoleRecord(staff.sessionId, key, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // The decision opens the registration console's case file of its application, for a reader that console admits.
  const application = data !== null && data.decision !== null ? await applicationOfDecision(staff, data.decision) : null;
  const officer = holds(staff, "ACT-OPS");
  // Back opens the list the reader works from: the re-decided obligations for the legal authority alone.
  const back = holds(staff, "ACT-OPS", "ACT-BIZ-APR", "ACT-AUD")
    ? { label: t("cer02.backList"), crumb: t("cer02.crumbList"), href: routes.opsStatusRecords() }
    : { label: t("cer02.backFollow"), crumb: t("cer02.crumbFollow"), href: routes.opsFollowUps() };

  return (
    <OpsFrame
      console="operations"
      current="records"
      staff={staff}
      searchLabel={t("cer.search")}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: back.crumb, href: back.href }]}
          title={data === null ? t("cer02.titleGeneric") : data.reference !== null ? t("cer02.titleRef", { r: data.reference }) : t("cer02.titlePending", { p: data.premises.name })}
          {...(data !== null ? { status: recordStatus(t, data.status) } : {})}
          {...(data !== null
            ? {
                meta:
                  data.status === "PENDING_ISSUE"
                    ? t("cer02.metaPending", { h: data.holder, ts: timestamp(data.asOf, locale) })
                    : t("cer02.meta", { p: data.premises.name, h: data.holder, ts: timestamp(data.asOf, locale) }),
              }
            : {})}
          locale={locale}
        >
          {data !== null && holds(staff, "ACT-OPS", "ACT-AUD") && (
            <Button variant="secondary" size="sm" icon="history" href={routes.opsStatusRecordHistory(data.key)} locale={locale}>
              {t("cer02.history")}
            </Button>
          )}
          {data !== null && officer && data.proposable && (
            <Button
              variant="primary"
              size="sm"
              href={routes.opsStatusRecordProposal(data.key, data.openReview?.state === "OPEN" ? data.openReview.reference : undefined)}
              locale={locale}
            >
              {t("cer02.propose")}
            </Button>
          )}
        </PageHeader>
        {view === "loading" ? (
          <Loading t={t} locale={locale} />
        ) : failure !== null || data === null ? (
          failure !== null && (
            <ConsoleFailure
              failure={failure}
              refusals={{
                CERTIFICATE_NOT_FOUND: { title: "cer02.nfTitle", text: "cer.refusal.CERTIFICATE_NOT_FOUND" },
                REFERENCE_DATA_UNAVAILABLE: { title: "cer02.ruTitle", text: "cer02.ruText", retry: routes.opsStatusRecord(key) },
              }}
              back={failure.code === "CERTIFICATE_NOT_FOUND" ? { label: back.label, href: back.href } : null}
              t={t}
              locale={locale}
            />
          )
        ) : (
          <RecordBody data={data} staff={staff} application={application} attempt={attempt?.record === key || attempt?.record === data.key || attempt?.record === data.reference ? attempt : null} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Loading({ t, locale }: { t: Translate; locale: Locale }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      <Panel title={t("cer02.recordTitle")} compact locale={locale}>
        <Skeleton variant="facts" rows={8} density="console" locale={locale} />
      </Panel>
      <Panel title={t("cer02.lastTitle")} compact locale={locale}>
        <Skeleton variant="card" rows={4} density="console" locale={locale} />
      </Panel>
      <Panel title={t("cer02.printTitle")} compact locale={locale}>
        <Skeleton variant="table" rows={2} columns={5} density="console" locale={locale} />
      </Panel>
    </div>
  );
}

function RecordBody({ data, staff, application, attempt, t, locale }: { data: ConsoleRecord; staff: Staff; application: string | null; attempt: RecordAttempt | null; t: Translate; locale: Locale }) {
  const officer = holds(staff, "ACT-OPS");
  const facts: Fact[] = [
    { label: t("cer02.fRef"), value: data.reference, kind: "id", missing: t("cer02.notIssued") },
    {
      label: t("cer02.fStatus"),
      value: recordStatus(t, data.status),
      kind: "status",
      note: t(data.status === "REPLACED" ? "cer02.sinceReplaced" : "cer02.since", { ts: timestamp(data.since, locale) }),
    },
    {
      label: t("cer02.fPremises"),
      // The premises opens its register page (SCR-PTY-07) for a reader the register admits.
      ...(data.premises.register !== null && holds(staff, "ACT-OPS", "ACT-DAT", "ACT-AUD")
        ? { value: { label: data.premises.name, href: routes.opsPremises(data.premises.register) }, kind: "link" as const }
        : { value: data.premises.name }),
      ...(data.premises.register !== null ? { note: data.premises.ward !== null ? `${data.premises.register}, ${data.premises.ward}` : data.premises.register } : {}),
    },
    { label: t("cer02.fHolder"), value: data.holder },
    ...(data.period !== null ? [{ label: t("cer02.fPeriod"), value: data.period, kind: "period" as const }] : []),
    {
      label: t("cer02.fDecision"),
      ...(data.decision !== null && application !== null
        ? { value: { label: data.decision, href: routes.opsApplication(application) }, kind: "link" as const }
        : { value: data.decision, kind: "mono" as const }),
      missing: t("cer.decisionUnknown"),
      ...(feeNote(data.fee, t, locale) !== null ? { note: feeNote(data.fee, t, locale) ?? "" } : {}),
    },
    ...(data.issued !== null
      ? [
          {
            label: t("cer02.fIssued"),
            value: data.issued.at,
            kind: "datetime" as const,
            ...(data.issued.route !== null ? { note: t(data.issued.route === "APPROVED" ? "cer02.approvedRoute" : "cer02.straight") } : {}),
          },
        ]
      : []),
    ...(data.predecessor !== null
      ? [{ label: t("cer02.fPredecessor"), value: { label: data.predecessor.reference, href: routes.opsStatusRecord(data.predecessor.reference) }, kind: "link" as const, note: t("cer02.heldBy", { h: data.predecessor.holder }) }]
      : []),
    ...(data.successor !== null
      ? [{ label: t("cer02.fSuccessor"), value: { label: data.successor.reference, href: routes.opsStatusRecord(data.successor.reference) }, kind: "link" as const, note: t("cer02.heldBy", { h: data.successor.holder }) }]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      <Panel title={t("cer02.recordTitle")} compact locale={locale}>
        <FactList items={facts} columns={2} density="console" locale={locale} />
        {data.definition !== null && (
          <>
            <Divider />
            {/* The four texts as the record copied them from its definition when it issued (FR-CER-019). */}
            <Disclosure title={t("cer02.asIssued")} meta={t("cer02.asIssuedMeta", { v: data.definition.version })} level={3} density="console" locale={locale}>
              <FactList
                items={[
                  { label: t("cer02.fName"), value: written(data.definition.legalName, locale) },
                  { label: t("cer02.fNature"), value: written(data.definition.legalNature, locale) },
                  { label: t("cer02.fIssuer"), value: written(data.definition.issuer, locale) },
                  { label: t("cer02.fEffect"), value: written(data.definition.legalEffect, locale) },
                ]}
                density="console"
                locale={locale}
              />
            </Disclosure>
          </>
        )}
      </Panel>
      {data.openReview !== null && <ReviewPanel review={data.openReview} t={t} locale={locale} />}
      <LastChangePanel change={data.lastChange} t={t} locale={locale} />
      {data.assessment !== null && <AssessmentPanel data={data} officer={officer} attempt={attempt} t={t} locale={locale} />}
      {data.renewal !== null && <RenewalPanel data={data} t={t} locale={locale} />}
      <PrintoutsPanel data={data} officer={officer} attempt={attempt} t={t} locale={locale} />
    </div>
  );
}

/** What raised a review, as the record page says it. */
function raisedBy(review: OpenReview, t: Translate, locale: Locale): Fact {
  switch (review.trigger.kind) {
    case "PAYMENT_REVERSAL":
      return { label: t("cer02.fRaised"), value: t("cer02.raisedReversal", { ts: timestamp(review.trigger.at, locale) }), note: review.trigger.event };
    case "CASE":
      return { label: t("cer02.fRaised"), value: t("cer02.raisedCase", { c: review.trigger.caseRef }), ...(review.trigger.letter !== null ? { note: review.trigger.letter } : {}) };
    default:
      return { label: t("cer02.fRaised"), value: t("cer02.raisedOfficer") };
  }
}

/** The record's open review, waiting for a proposal or for an approver (finding F-2). */
function ReviewPanel({ review, t, locale }: { review: OpenReview; t: Translate; locale: Locale }) {
  const proposal = review.proposal;
  const facts: Fact[] = [
    raisedBy(review, t, locale),
    { label: t("cer02.fOpened"), value: review.openedAt, kind: "datetime" },
    {
      label: t("cer02.fProposal"),
      value:
        proposal === null
          ? t("cer02.noProposal")
          : proposal.effectiveAt !== null
            ? t("cer02.proposalFrom", { act: t(`cer.act.${proposal.act}`), ts: timestamp(proposal.effectiveAt, locale) })
            : t("cer02.proposalWhenApproved", { act: t(`cer.act.${proposal.act}`) }),
    },
    ...((proposal?.ground !== undefined && proposal?.ground !== null) ? [{ label: t("cer02.fGround"), value: t(`cer.ground.${proposal.ground}`) }] : []),
    ...((proposal?.condition !== undefined && proposal?.condition !== null) && proposal.act === "SUSPEND" ? [{ label: t("cer02.fReinstate"), value: t(`cer.reinstate.${proposal.condition}`) }] : []),
    ...(proposal !== null ? [{ label: t("cer02.fReason"), value: written(proposal.reason, locale) }] : []),
  ];
  return (
    <Panel
      title={t("cer02.reviewTitle", { r: review.reference })}
      status={reviewStatus(t, review.state)}
      action={{ label: t("cer02.reviewsLink"), href: routes.opsStatusReviews(), kind: "link" }}
      compact
      locale={locale}
    >
      <FactList items={facts} columns={2} density="console" locale={locale} />
      {proposal !== null && (
        <ApprovalPair
          preparer={{ name: proposal.proposer.name, role: proposal.proposer.position, at: proposal.proposer.at }}
          approver={null}
          awaiting={t("cer02.waitApprover")}
          preparerLabel={t("cer02.proposedBy")}
          approverLabel={t("cer02.decidedBy")}
          locale={locale}
        />
      )}
    </Panel>
  );
}

function LastChangePanel({ change, t, locale }: { change: LastChange; t: Translate; locale: Locale }) {
  const defaultRemedy = { label: t("cer02.fRemedy"), value: t("cer02.remedyDefault") };
  let facts: Fact[];
  let action: { label: string; href: string; kind: "link" } | null = null;
  switch (change.kind) {
    case "opened":
      facts = [{ label: t("cer02.fChange"), value: t("cer02.chPending", { d: change.decision }) }, { label: t("cer02.fEffective"), value: change.at, kind: "datetime" }, defaultRemedy];
      break;
    case "issued":
      facts = [{ label: t("cer02.fChange"), value: t("cer02.chIssued") }, { label: t("cer02.fEffective"), value: change.at, kind: "datetime" }, defaultRemedy];
      break;
    case "replaced":
      facts = [
        { label: t("cer02.fChange"), value: t("cer02.chReplaced", { r: change.successor }) },
        { label: t("cer02.fEffective"), value: change.at, kind: "datetime" },
        {
          label: t("cer02.fCause"),
          value: change.approver !== null ? t("cer02.causeReplaced", { r: change.successor, h: change.holder, a: change.approver }) : t("cer02.causeReplacedStraight", { r: change.successor, h: change.holder }),
        },
        defaultRemedy,
      ];
      // A replaced record links to the approval that issued its successor.
      if (change.approver !== null) action = { label: t("cer02.approvalLink"), href: routes.opsStatusRecordApproval(change.successor), kind: "link" };
      break;
    case "status":
      facts = [
        { label: t("cer02.fChange"), value: t(`cer02.ch.${change.to}`) },
        { label: t("cer02.fEffective"), value: change.effectiveAt, kind: "datetime" },
        ...(change.ground !== null
          ? [{ label: t("cer02.fGround"), value: t(`cer.ground.${change.ground}`), note: change.policyVersion !== null ? t("cer02.policyVersion", { v: change.policyVersion }) : t("cer02.policyVal") }]
          : []),
        ...(change.condition !== null ? [{ label: t("cer02.fReinstate"), value: t(`cer.reinstate.${change.condition}`) }] : []),
        ...(change.reason !== null ? [{ label: t("cer02.fReason"), value: written(change.reason, locale) }] : []),
        ...(change.evidence.length > 0 ? [{ label: t("cer02.fEvidence"), value: change.evidence.join(", "), kind: "mono" as const }] : []),
        change.remedy.closesOn !== null ? { label: t("cer02.fRemedy"), value: t("cer02.remedyGround", { d: date(change.remedy.closesOn, locale) }) } : defaultRemedy,
        { label: t("cer02.fNotice"), value: change.notice !== null ? t("cer02.noticeRef", { n: change.notice }) : t("cer02.noticeNone") },
        ...(change.review !== null ? [{ label: t("cer02.fReview"), value: change.review, kind: "mono" as const }] : []),
      ];
      break;
    case "automatic":
      // A change no one decided: what it rests on is the expiry notice, or the period that ended or began.
      facts = [
        { label: t("cer02.fChange"), value: t(`cer02.auto.${change.cause}`) },
        { label: t("cer02.fEffective"), value: change.at, kind: "datetime" },
        ...(change.decision !== null ? [{ label: t("cer02.fDecision"), value: change.decision, kind: "mono" as const }] : []),
        { label: t("cer02.fNotice"), value: change.notice !== null ? t("cer02.noticeRef", { n: change.notice }) : t("cer02.noticeNone") },
        defaultRemedy,
      ];
      break;
  }
  return (
    <Panel title={t("cer02.lastTitle")} {...(action !== null ? { action } : {})} compact locale={locale}>
      <FactList items={facts} columns={2} density="console" locale={locale} />
      {change.kind === "status" && change.proposer !== null && change.approver !== null && (
        <ApprovalPair
          preparer={{ name: change.proposer.name, role: change.proposer.position, at: change.proposer.at }}
          approver={{ name: change.approver.name, role: change.approver.position, at: change.approver.at }}
          decision="approved"
          {...(change.comment !== null ? { comment: written(change.comment, locale) ?? "" } : {})}
          preparerLabel={t("cer02.proposedBy")}
          approverLabel={t("cer02.decidedBy")}
          locale={locale}
        />
      )}
    </Panel>
  );
}

/** While the record waits to issue: when it was assessed, whether every condition holds, the route and the approver's decision. */
function AssessmentPanel({ data, officer, attempt, t, locale }: { data: ConsoleRecord; officer: boolean; attempt: RecordAttempt | null; t: Translate; locale: Locale }) {
  const assessment = data.assessment;
  if (assessment === null) return null;
  const refusal = (attempt?.assess !== undefined && attempt?.assess !== null) && "refusal" in attempt.assess ? attempt.assess.refusal : null;
  const assessed = (attempt?.assess !== undefined && attempt?.assess !== null) && "issued" in attempt.assess;
  const unmet = assessment.unmet.length;
  return (
    <Panel title={t("cer02.assessTitle")} compact locale={locale}>
      {refusal !== null && (
        <Banner
          family="attention"
          title={refusal === "PREDECESSOR_ENDED" ? t("cer02.peTitle", { r: data.predecessor?.reference ?? "" }) : t("cer02.npTitle")}
          code={refusal}
          action={{ label: t("cer02.reload"), icon: "refresh-cw", variant: "secondary", href: routes.opsStatusRecord(data.key) }}
          compact
          density="console"
          live
          locale={locale}
        >
          {t(`cer.refusal.${refusal === "PREDECESSOR_ENDED" || refusal === "NOT_PENDING_ISSUE" || refusal === "CERTIFICATE_NOT_FOUND" ? refusal : "NOT_AUTHORISED"}`)}
        </Banner>
      )}
      {assessed && (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="neutral" title={t("cer02.assessedTitle")} locale={locale} />
        </div>
      )}
      <FactList
        items={[
          { label: t("cer02.fAssessed"), value: t(`cer02.assessed.${assessment.trigger}`, { ts: timestamp(assessment.at, locale) }) },
          { label: t("cer02.fOutcome"), value: unmet === 0 ? t("cer02.allHold") : unmet === 1 ? t("cer02.oneUnmet") : t("cer02.manyUnmet", { n: unmet }) },
          ...(assessment.route !== null ? [{ label: t("cer02.fRoute"), value: t(`cer02.route.${assessment.route}`) }] : []),
          ...(assessment.route !== null && assessment.route !== "STRAIGHT_THROUGH"
            ? [
                {
                  label: t("cer02.fApproval"),
                  value:
                    assessment.decided === null
                      ? t("cer02.notDecided")
                      : t(assessment.decided.outcome === "DECLINE" ? "cer02.declinedBy" : "cer02.approvedBy", { by: assessment.decided.by, ts: timestamp(assessment.decided.at, locale) }),
                },
              ]
            : []),
        ]}
        columns={2}
        density="console"
        locale={locale}
      />
      {unmet > 0 && (
        <ItemList
          items={assessment.unmet.map((condition) => ({ key: condition, title: t(`cer.condition.${condition}`), family: "attention" as const }))}
          readOnly
          density="console"
          label={t("cer02.unmetLabel")}
          locale={locale}
        />
      )}
      {officer && (
        <form action={assessStatusRecord}>
          <input type="hidden" name="record" value={data.key} />
          <Button variant="secondary" size="sm" icon="refresh-cw" type="submit" locale={locale}>
            {t("cer02.assessAgain")}
          </Button>
        </form>
      )}
    </Panel>
  );
}

/**
 * A renewal waiting on the record (`DR-432` row 2): its decision, period and fee, and its latest assessment. It adds
 * its period once every condition holds, by itself or on an approver's approval, which SCR-CER-03 takes.
 */
function RenewalPanel({ data, t, locale }: { data: ConsoleRecord; t: Translate; locale: Locale }) {
  const renewal = data.renewal;
  if (renewal === null) return null;
  const assessment = renewal.assessment;
  const unmet = assessment?.unmet ?? [];
  const waitsApprover = assessment !== null && unmet.length === 0 && assessment.route !== null && assessment.route !== "STRAIGHT_THROUGH" && assessment.decided === null;
  return (
    <Panel
      title={t("cer02.renewalTitle")}
      {...(waitsApprover ? { action: { label: t("cer02.renewalApproval"), href: routes.opsStatusRecordApproval(data.key), kind: "link" as const } } : {})}
      compact
      locale={locale}
    >
      <FactList
        items={[
          { label: t("cer02.fDecision"), value: renewal.decision, kind: "mono", ...(feeNote(renewal.fee, t, locale) !== null ? { note: feeNote(renewal.fee, t, locale) ?? "" } : {}) },
          { label: t("cer02.fPeriod"), value: renewal.period, kind: "period" },
          { label: t("cer02.fOpened"), value: renewal.openedAt, kind: "datetime" },
          ...(assessment !== null
            ? [
                { label: t("cer02.fAssessed"), value: t(`cer02.assessed.${assessment.trigger}`, { ts: timestamp(assessment.at, locale) }) },
                { label: t("cer02.fOutcome"), value: unmet.length === 0 ? t("cer02.allHold") : unmet.length === 1 ? t("cer02.oneUnmet") : t("cer02.manyUnmet", { n: unmet.length }) },
                ...(assessment.route !== null ? [{ label: t("cer02.fRoute"), value: t(`cer02.route.${assessment.route}`) }] : []),
              ]
            : []),
        ]}
        columns={2}
        density="console"
        locale={locale}
      />
      {unmet.length > 0 && (
        <ItemList
          items={unmet.map((condition) => ({ key: condition, title: t(`cer.condition.${condition}`), family: "attention" as const }))}
          readOnly
          density="console"
          label={t("cer02.unmetLabel")}
          locale={locale}
        />
      )}
    </Panel>
  );
}

function PrintoutsPanel({ data, officer, attempt, t, locale }: { data: ConsoleRecord; officer: boolean; attempt: RecordAttempt | null; t: Translate; locale: Locale }) {
  const active = recordStatus(t, "ACTIVE");
  const refusal = attempt?.print?.refusal ?? null;
  return (
    <Panel title={t("cer02.printTitle")} compact locale={locale}>
      {data.printouts.length > 0 ? (
        <Table
          columns={[
            { key: "ref", label: t("cer02.cPrintout"), kind: "id" },
            { key: "kind", label: t("cer02.cKind") },
            { key: "printed", label: t("cer02.cPrinted"), kind: "stamp", nowrap: true },
            { key: "key", label: t("cer02.cKey"), kind: "mono" },
            { key: "at", label: t("cer02.cAtPrint"), kind: "status" },
          ]}
          rows={data.printouts.map((printout) => ({
            _key: printout.reference,
            ref: printout.reference,
            kind: t("cer02.printable"),
            printed: printout.printedAt,
            key: printout.signingKey,
            at: printout.stillTheStatus ? active : { ...active, detail: t("cer02.noLonger") },
          }))}
          density="console"
          caption={t("cer02.printTitle")}
          locale={locale}
        />
      ) : (
        <Text size="sm" tone="secondary">
          {t("cer02.noPrintouts")}
        </Text>
      )}
      {refusal !== null && (
        <Banner family="attention" title={t("cer02.printRefusedTitle")} code={refusal} density="console" live locale={locale}>
          {t(`cer.refusal.${refusal === "SIGNING_UNAVAILABLE" || refusal === "RECORD_NOT_CURRENT" ? refusal : "NOT_AUTHORISED"}`)}
        </Banner>
      )}
      {officer && data.reference !== null && (
        <form action={printFromConsole}>
          <input type="hidden" name="record" value={data.reference} />
          <ButtonRow>
            <Button
              variant="secondary"
              size="sm"
              icon="printer"
              type="submit"
              {...(!data.current ? { disabled: true, disabledReason: t("cer.refusal.RECORD_NOT_CURRENT") } : {})}
              locale={locale}
            >
              {t("cer02.print")}
            </Button>
          </ButtonRow>
        </form>
      )}
    </Panel>
  );
}

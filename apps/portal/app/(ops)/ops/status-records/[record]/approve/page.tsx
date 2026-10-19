import { Banner, Button, Combobox, Divider, FactList, ItemList, PageHeader, Panel, Skeleton, TextField, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { decideIssueAction } from "@/features/status-records/actions";
import { ConsoleFailure } from "@/features/status-records/console";
import { DecisionControls } from "@/features/status-records/DecisionControls";
import { feeNote, recordStatus, timestamp, written } from "@/features/status-records/words";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff } from "@/lib/api/session";
import { loadIssueApproval, type IssueApproval, type IssueAttempt } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER03_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "cer03-decision";

/** The refusals of an issue decision drawn in place of the decision, each with the board's title. */
const IN_PLACE = ["ISSUE_NOT_AWAITING_APPROVAL", "ISSUE_CONDITIONS_NOT_MET", "PREDECESSOR_ENDED", "NOT_AUTHORISED"] as const;

/**
 * SCR-CER-03 Approve an issue. The independent business approver reads why a record waits for approval (the holder
 * changed, a claim is pending, the classification was declared), the decision it rests on and the record it
 * replaces, checks what the board asks, and approves or declines with evidence and a reason. An approval assesses
 * the record again and issues it; a decline leaves it pending until a new assessment. An operations officer reads
 * the page refused.
 */
export default async function ApproveIssuePage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  // The approver decides here; the operations officer, who opens it from the list, reads it refused.
  const staff = await requireStaff("ACT-BIZ-APR", "ACT-OPS");
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const key = decodeURIComponent(record);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, CER03_VIEWS);
  const kept = view === null ? readForPage<IssueAttempt>(query) : null;
  const attempt = kept?.record === key ? kept : null;
  const outcome = view === "loading" ? null : await loadIssueApproval(staff.sessionId, key, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="records" staff={staff} searchLabel={t("cer.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cer03.crumb"), href: routes.opsStatusRecords() }]}
          title={data !== null ? t("cer03.title", { p: data.premises.name }) : t("cer03.titlePlain")}
          {...(data !== null ? { status: recordStatus(t, data.status), meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Panel gap="xl" locale={locale}>
            <Skeleton variant="facts" rows={6} density="console" locale={locale} />
            <Skeleton variant="card" rows={3} density="console" locale={locale} />
          </Panel>
        ) : failure !== null || data === null ? (
          failure !== null && (
            <ConsoleFailure
              failure={failure}
              refusals={{ CERTIFICATE_NOT_FOUND: { title: "cer02.nfTitle", text: "cer.refusal.CERTIFICATE_NOT_FOUND" } }}
              back={{ label: t("cer03.back"), href: routes.opsStatusRecords() }}
              t={t}
              locale={locale}
            />
          )
        ) : (
          <Approval data={data} approver={holds(staff, "ACT-BIZ-APR")} attempt={attempt} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function meta(data: IssueApproval, t: Translate, locale: Locale): string {
  if (data.reference !== null && data.status !== "PENDING_ISSUE") return t("cer03.metaIssued", { h: data.holder, ts: timestamp(data.decided?.at ?? data.pendingSince, locale) });
  const since = timestamp(data.pendingSince, locale);
  return data.awaitsApprover ? t("cer03.meta", { h: data.holder, since }) : t("cer03.metaPending", { h: data.holder, since });
}

function Approval({ data, approver, attempt, t, locale }: { data: IssueApproval; approver: boolean; attempt: IssueAttempt | null; t: Translate; locale: Locale }) {
  const assessment = data.assessment;
  const holderChanged = data.predecessor !== null && data.route === "HOLDER_CHANGED";
  const refused = attempt?.refusal ?? null;
  // An officer reads the issue with no decision of their own: the server refuses them whatever the page shows.
  const notAuthorised = !approver;
  const showForm = approver && data.awaitsApprover && (attempt?.done === undefined || attempt?.done === null);
  const decided = data.decided;
  const showDecided = decided !== null && ((attempt?.done !== undefined && attempt?.done !== null) || !data.awaitsApprover) && refused === null;
  // A refusal of the last act, or an issue no longer waiting for an approver: said in place of the decision.
  const inPlace = refused !== null ? refused.code : !showForm && !showDecided && !notAuthorised ? "ISSUE_NOT_AWAITING_APPROVAL" : null;

  const facts = [
    ...(data.route !== null ? [{ label: t("cer03.fRoute"), value: t(`cer03.route.${data.route}`) }] : []),
    { label: holderChanged ? t("cer03.fHolderNew") : t("cer03.fHolder"), value: data.holder },
    {
      label: t("cer03.fPremises"),
      value: data.premises.name,
      ...(data.premises.register !== null ? { note: data.premises.ward !== null ? `${data.premises.register}, ${data.premises.ward}` : data.premises.register } : {}),
    },
    { label: t("cer03.fDecision"), value: data.decision, kind: "mono" as const, ...(feeNote(data.fee, t, locale) !== null ? { note: feeNote(data.fee, t, locale) ?? "" } : {}) },
    ...(data.period !== null ? [{ label: t("cer03.fPeriod"), value: data.period, kind: "period" as const }] : []),
    ...(data.predecessor !== null
      ? [
          {
            label: t("cer03.fPredecessor"),
            value: { label: data.predecessor.reference, href: routes.opsStatusRecord(data.predecessor.key) },
            kind: "link" as const,
            note: t("cer03.heldBy", { h: data.predecessor.holder }),
          },
        ]
      : []),
    // A renewal adds its period to the record it renews, under the same reference (FR-CER-010).
    ...(data.renewal !== null
      ? [{ label: t("cer03.fRenews"), value: { label: data.renewal.record, href: routes.opsStatusRecord(data.renewal.record) }, kind: "link" as const, note: t("cer03.renewsNote") }]
      : []),
    ...(assessment !== null
      ? [{ label: t("cer03.fAssessed"), value: assessment.at, kind: "datetime" as const, note: t(assessment.unmet.length === 0 ? "cer03.assessedNote" : "cer03.oneUnmet") }]
      : []),
    ...(decided?.outcome === "DECLINE" && !showDecided ? [{ label: t("cer03.fApproval"), value: t("cer03.declinedBy", { by: decided.by, ts: timestamp(decided.at, locale) }) }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      {(attempt?.done !== undefined && attempt?.done !== null) && decided !== null && (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast
            family={attempt.done === "approved" ? "positive" : "neutral"}
            title={attempt.done === "approved" ? t("cer03.okTitle", { r: data.reference ?? "" }) : t("cer03.decTitle")}
            action={{ label: t("cer03.back"), href: routes.opsStatusRecords() }}
            locale={locale}
          >
            {attempt.done === "approved"
              ? data.predecessor !== null
                ? t("cer03.okText", { old: data.predecessor.reference })
                : t("cer03.okTextPlain")
              : t("cer03.decText")}
          </Toast>
        </div>
      )}
      {notAuthorised && (
        <Banner
          family="attention"
          title={t("cer03.naTitle")}
          code="NOT_AUTHORISED"
          action={{ label: t("cer03.back"), href: routes.opsStatusRecords(), variant: "secondary" }}
          density="console"
          locale={locale}
        >
          {t("cer.refusal.NOT_AUTHORISED")}
        </Banner>
      )}
      <Panel gap="xl" locale={locale}>
        <Panel variant="plain" level={2} title={t(data.awaitsApprover ? "cer03.whyTitle" : "cer03.whyDone")} compact locale={locale}>
          <FactList items={facts} columns={2} density="console" locale={locale} />
        </Panel>
        {showForm && holderChanged && data.predecessor !== null && (
          // The transfer of the outgoing holder's record is decided in Parties and premises (SCR-PTY-16).
          <Banner
            family="info"
            title={t("cer03.checkTitle")}
            action={{ label: t("cer03.checkOpen"), href: routes.opsEntitlementDispositions(data.predecessor.reference), variant: "secondary" }}
            compact
            density="console"
            locale={locale}
          >
            {t("cer03.checkText", { r: data.predecessor.reference, h: data.predecessor.holder })}
          </Banner>
        )}
        {(showForm || showDecided || inPlace !== null) && <Divider />}
        {showForm && <DecisionForm data={data} attempt={attempt} holderChanged={holderChanged} t={t} locale={locale} />}
        {showDecided && decided !== null && (
          <>
            <Panel variant="plain" level={2} title={t("cer03.recordedTitle")} compact locale={locale}>
              <FactList
                items={[
                  {
                    label: t("cer03.fOutcome"),
                    value: decided.outcome === "APPROVE" ? t("cer03.approvedVal", { r: data.reference ?? "" }) : t("cer03.declinedVal"),
                  },
                  { label: t("cer03.fDecidedBy"), value: decided.by, note: timestamp(decided.at, locale) },
                  { label: t("cer03.fEvidence"), value: decided.evidence.length > 0 ? decided.evidence.join("; ") : null, missing: t("cer03.noEvidence") },
                  { label: t("cer03.fReason"), value: written(decided.reason, locale), missing: t("cer03.noReason") },
                ]}
                columns={2}
                density="console"
                locale={locale}
              />
            </Panel>
            <div>
              <Button variant="secondary" size="sm" href={routes.opsStatusRecords()} locale={locale}>
                {t("cer03.back")}
              </Button>
            </div>
          </>
        )}
        {inPlace !== null && <InPlace code={inPlace} data={data} unmet={refused?.unmet ?? []} t={t} locale={locale} />}
      </Panel>
    </div>
  );
}

function InPlace({ code, data, unmet, t, locale }: { code: string; data: IssueApproval; unmet: readonly string[]; t: Translate; locale: Locale }) {
  const known = (IN_PLACE as readonly string[]).includes(code) ? code : "ISSUE_NOT_AWAITING_APPROVAL";
  const decided = data.decided;
  const title =
    known === "ISSUE_CONDITIONS_NOT_MET"
      ? t("cer03.icnTitle")
      : known === "PREDECESSOR_ENDED"
        ? t("cer03.peTitle", { r: data.predecessor?.reference ?? "" })
        : known === "NOT_AUTHORISED"
          ? t("cer03.naTitle")
          : decided !== null
            ? t("cer03.nawTitle", { t: timestamp(decided.at, locale) })
            : t("cer03.nawTitlePlain");
  return (
    <>
      <Banner family="attention" title={title} code={known} density="console" live locale={locale}>
        {known === "ISSUE_CONDITIONS_NOT_MET" ? t("cer03.icnText") : t(`cer.refusal.${known}`)}
        {unmet.length > 0 && (
          <ItemList
            items={unmet.map((condition) => ({ key: condition, title: t(`cer.condition.${condition}`) }))}
            readOnly
            numbered
            density="console"
            label={t("cer03.unmetLabel")}
            locale={locale}
          />
        )}
      </Banner>
      <div>
        <Button variant="secondary" size="sm" href={routes.opsStatusRecords()} locale={locale}>
          {t("cer03.back")}
        </Button>
      </div>
    </>
  );
}

/** Evidence and a reason, then Approve (confirmed) and Decline. */
function DecisionForm({ data, attempt, holderChanged, t, locale }: { data: IssueApproval; attempt: IssueAttempt | null; holderChanged: boolean; t: Translate; locale: Locale }) {
  const values = attempt?.values ?? { evidence: [], reason: "" };
  return (
    <form id={FORM} action={decideIssueAction} noValidate style={{ display: "contents" }}>
      <input type="hidden" name="record" value={data.key} />
      <Panel variant="plain" level={2} title={t("cer03.decisionTitle")} compact locale={locale}>
        <Combobox
          multiple
          allowCustom
          customLabel={t("cer03.addRef")}
          label={t("cer03.evidence")}
          helper={holderChanged && data.predecessor !== null ? t("cer03.evidenceHelp", { r: data.predecessor.reference }) : t("cer03.evidenceHelpPlain")}
          name="evidence_refs"
          options={values.evidence.map((item) => ({ value: item, label: item }))}
          value={[...values.evidence]}
          placeholder={t("cer03.evidencePh")}
          density="console"
          width="100%"
          locale={locale}
        />
        <TextField
          label={t("cer03.reason")}
          helper={t("cer03.reasonHelp")}
          name="reason"
          value={values.reason}
          {...(attempt?.refusal?.code === "REASON_REQUIRED" ? { error: t("cer.refusal.REASON_REQUIRED") } : {})}
          wrap
          maxLength={2000}
          density="console"
          width="100%"
          locale={locale}
        />
      </Panel>
      <DecisionControls
        formId={FORM}
        approve={{ label: t("cer03.approve"), icon: "check" }}
        decline={{ label: t("cer03.decline"), variant: "secondary" }}
        back={{ label: t("cer03.back"), href: routes.opsStatusRecords(), variant: "quiet" }}
        dialog={{
          title: t("cer03.dlgTitle", { p: data.premises.name }),
          description:
            holderChanged && data.predecessor !== null
              ? t("cer03.dlgText", { h: data.holder, old: data.predecessor.holder })
              : t("cer03.dlgTextPlain", { h: data.holder }),
          yes: { label: t("cer03.dlgYes"), variant: "primary" },
          cancel: t("cer03.dlgBack"),
          facts: data.predecessor !== null ? [{ label: t("cer03.fPredecessor"), value: data.predecessor.reference, kind: "mono" }] : [],
          typed: [
            { name: "evidence_refs", label: t("cer03.fEvidence"), none: t("cer03.noEvidence"), many: true },
            { name: "reason", label: t("cer03.fReason"), none: t("cer03.noReason") },
          ],
        }}
        label={t("cer03.decisionTitle")}
        locale={locale}
      />
    </form>
  );
}

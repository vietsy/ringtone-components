import { Banner, Button, FactList, ItemList, PageHeader, Panel, Skeleton, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { AmendmentFields } from "@/features/registration/AmendmentFields";
import { ConfirmSubmit } from "@/features/registration/ConfirmSubmit";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { CorrectionPanel, type CorrectableFact } from "@/features/registration/CorrectionPanel";
import {
  actorWords,
  codeStatus,
  day,
  documentInLine,
  documentTitle,
  factValue,
  fileWords,
  holdSentence,
  layerWords,
  moment,
  money,
  reasonWords,
  refusal,
  regOpsTranslator,
  reviewTypeWords,
} from "@/features/registration/console-copy";
import { readDate } from "@/features/registration/fields";
import { correctFact, sendAmendmentAct, startAmendment } from "@/features/registration/review-actions";
import { ShortcutButton } from "@/features/registration/ShortcutButton";
import { readForPage } from "@/lib/api/flash";
import {
  loadCaseFile,
  type AmendmentAttempt,
  type CaseClaim,
  type CaseEvidence,
  type CaseFact,
  type CaseFile,
  type CaseProposal,
  type CaseRequest,
  type CorrectionAttempt,
} from "@/lib/api/registration-review";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG10_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "correct-fact";
/** The facts an officer may correct while the application is in review: those the premises declares. */
const CORRECTABLE = ["premises_class", "customer_area", "days_open", "music_method", "use_began_on"] as const;
const CLASSES = ["cafe", "restaurant", "bar", "karaoke", "hotel", "shop"] as const;
const METHODS = ["speakers", "live", "both", "screens"] as const;

/**
 * SCR-REG-10 Application case file, the hub of the console. Everything recorded about one application - facts
 * with their labels and classes, every version kept; documents; claims; confirmations; evidence requests; date
 * statements; proposals; the decision; the history - and the controls that open each act on it, each disabled with
 * the sentence that holds it (convention 14). The data owner reads it without the acts, with each registry
 * fact's source.
 */
export default async function CaseFilePage({ params, searchParams }: { params: Promise<{ application: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-DAT");
  const [{ application }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG10_VIEWS);
  const outcome = asked === "loading" ? null : await loadCaseFile(staff, application, reviewViewOf("10", asked));
  const record = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const last = readForPage<CorrectionAttempt | AmendmentAttempt>(query);
  const attempt = last?.page === "case-file" && last.application === application ? last : null;
  const amendment = last?.page === "amendment" && last.application === application ? last : null;
  const officer = record === null ? true : !record.dataOwner;

  return (
    <OpsFrame
      console="operations"
      current="registration"
      staff={staff}
      searchLabel={t("regops.search")}
      {...(officer ? { keyMap: [{ keys: ["Esc"], label: t("regops.keyEsc") }] } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={officer ? [{ label: t("regops.crumb") }, { label: t("regops.queue"), href: routes.opsRegistration() }] : [{ label: t("regops.crumb") }]}
          title={record !== null ? t("reg10.title", { ref: record.reference, p: record.premises.name }) : t("reg10.titleGeneric")}
          {...(record !== null ? { status: codeStatus(record.status), meta: headerMeta(record, t, locale) } : {})}
          locale={locale}
        >
          <Button variant="secondary" size="sm" icon="refresh-cw" href={routes.opsApplication(application)} locale={locale}>
            {t("regops.reload")}
          </Button>
          {officer && record !== null ? <SendAmendment record={record} t={t} locale={locale} /> : null}
          {officer ? (
            <Button variant="quiet" size="sm" href={routes.opsRegistration()} locale={locale}>
              {t("regops.backQueue")}
            </Button>
          ) : null}
        </PageHeader>
        {attempt !== null && !FIELD_CODES.includes(attempt.code) ? (
          <Banner family="attention" title={refusal(t, attempt.code).title} code={attempt.code} density="console" live locale={locale}>
            {refusal(t, attempt.code).text}
          </Banner>
        ) : null}
        {amendment?.act === "send" ? (
          <Banner family="attention" title={refusal(t, amendment.code).title} code={amendment.code} density="console" live locale={locale}>
            {refusal(t, amendment.code).text}
          </Banner>
        ) : null}
        {asked === "loading" ? <Loading officer={officer} /> : null}
        {failure !== null ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            <ConsoleFailure failure={failure} t={t} locale={locale} />
            {officer ? (
              <Button variant="secondary" size="sm" href={routes.opsRegistration()} locale={locale}>
                {t("regops.backQueue")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {record !== null ? <CaseFileBody record={record} attempt={attempt} amendment={amendment?.act === "start" ? amendment : null} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** The codes a correction is refused with beside its field; any other is said above the record. */
const FIELD_CODES: readonly string[] = ["FACT_VALUE_INVALID", "FACT_NOT_IN_RULEBOOK"];

function columns(officer: boolean) {
  return { display: "grid", gridTemplateColumns: officer ? "minmax(0, 1fr) var(--container-3xs)" : "minmax(0, 1fr)", gap: "var(--space-6)", alignItems: "start" } as const;
}

function Loading({ officer }: { officer: boolean }) {
  return (
    <div style={columns(officer)}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Panel compact>
          <Skeleton variant="facts" rows={6} density="console" />
        </Panel>
        <Panel compact>
          <Skeleton variant="table" rows={3} columns={5} density="console" />
        </Panel>
        <Panel compact>
          <Skeleton variant="table" rows={3} columns={5} density="console" />
        </Panel>
      </div>
      {officer ? (
        <Panel compact>
          <Skeleton variant="card" rows={4} density="console" />
        </Panel>
      ) : null}
    </div>
  );
}

function headerMeta(record: CaseFile, t: Translate, locale: Locale): string {
  const rb = record.rulebook;
  const own = `${amendmentLine(record, t)}${record.firstSavedAt !== null ? ` ${t("reg10.firstSaved", { ts: moment(record.firstSavedAt, locale) })}` : ""}${record.dataOwner ? ` ${t("reg10.ownerNote")}` : ""}`;
  if (record.status === "DRAFT") return t("reg10.metaDraft", { kind: record.kind, rb }) + own;
  const ts = record.submittedAt !== null ? moment(record.submittedAt, locale) : null;
  if (record.route === "AUTOMATED") {
    return (ts !== null ? t("reg10.metaAuto", { kind: record.kind, route: "AUTOMATED", ts, rb }) : t("reg10.metaAutoNoTs", { kind: record.kind, route: "AUTOMATED", rb })) + own;
  }
  const values = { kind: record.kind, type: reviewTypeWords(record.reviewType, t), route: record.route ?? "MANUAL", rb };
  return (ts !== null ? t("reg10.metaApp", { ...values, ts }) : t("reg10.metaAppNoTs", values)) + own;
}

/** An amendment's cause, the appeal case it follows and who started it, as the header says them. */
function amendmentLine(record: CaseFile, t: Translate): string {
  const amendment = record.amendment;
  if (amendment === null) return "";
  const caseLine = amendment.caseRef !== null ? ` ${t("reg10.amendCase", { ref: amendment.caseRef })}` : "";
  return ` ${t("reg10.amendOf", { d: amendment.decision, c: t(`reg10.cause.${amendment.cause}`) })}${caseLine} ${t(`reg10.amendBy.${amendment.initiatedBy}`)}`;
}

const SEND_FORM = "send-amendment";

/** Send the amendment, in the header of an amendment an officer started while it is a draft, held by what would refuse it. */
function SendAmendment({ record, t, locale }: { record: CaseFile; t: Translate; locale: Locale }) {
  const amendment = record.amendment;
  if (amendment === null || amendment.initiatedBy !== "OFFICER" || record.status !== "DRAFT") return null;
  return (
    <form id={SEND_FORM} action={sendAmendmentAct.bind(null, record.reference)}>
      <ConfirmSubmit
        formId={SEND_FORM}
        label={t("reg10.send")}
        disabledReason={amendment.sendHeld !== null ? holdSentence(t, amendment.sendHeld) : null}
        dialog={{ title: t("reg10.sendDlgTitle", { d: amendment.decision }), description: t("reg10.sendDlgText"), confirm: t("reg10.send"), back: t("regops.cancel") }}
        locale={locale}
      />
    </form>
  );
}

const AMEND_FORM = "start-amendment";
/** The codes Start an amendment is refused with beside a field, by the field. */
const AMEND_FIELDS: Readonly<Record<string, "cause" | "caseRef" | "from">> = { AMENDMENT_CAUSE_REQUIRED: "cause", APPEAL_CASE_NOT_FOUND: "caseRef", INTENDED_PERIOD_INVALID: "from" };

/** Start an amendment: the panel under the acts while the decision is current, with a refusal in it, values kept. */
function StartAmendment({ record, attempt, t, locale }: { record: CaseFile; attempt: AmendmentAttempt | null; t: Translate; locale: Locale }) {
  const amend = record.amend;
  if (amend === null) return null;
  const field = attempt !== null ? (AMEND_FIELDS[attempt.code] ?? null) : null;
  const fieldError = (name: "cause" | "caseRef" | "from") => {
    if (attempt === null || field !== name) return null;
    if (name === "from") return t("reg10.amend.fromInvalid", { d: day(amend.to, locale) });
    // An appeal outcome with no case reference is held on the reference.
    return name === "cause" && attempt.values.cause === "APPEAL_OUTCOME" ? null : refusal(t, attempt.code).text;
  };
  const causeError = fieldError("cause");
  const caseError = fieldError("caseRef") ?? (attempt?.code === "AMENDMENT_CAUSE_REQUIRED" && attempt.values.cause === "APPEAL_OUTCOME" ? refusal(t, attempt.code).text : null);
  return (
    <form id={AMEND_FORM} action={startAmendment.bind(null, record.reference, amend.decision)}>
      {attempt !== null && field === null ? (
        <Banner family="attention" title={refusal(t, attempt.code).title} code={attempt.code} density="console" live locale={locale}>
          {refusal(t, attempt.code).text}
          {attempt.openApplication !== null ? ` ${attempt.openApplication}` : ""}
        </Banner>
      ) : null}
      <AmendmentFields
        formId={AMEND_FORM}
        words={{
          title: t("reg10.amend.title"),
          description: t("reg10.amend.desc", { d: amend.decision }),
          cause: t("reg10.amend.cause"),
          causes: (["APPEAL_OUTCOME", "CLASSIFICATION_RECONCILED"] as const).map((value) => ({ value, label: t(`reg10.cause.${value}`) })),
          caseRef: t("reg10.amend.caseRef"),
          caseRefHelp: t("reg10.amend.caseRefHelp"),
          from: t("reg10.amend.from"),
          fromHelp: t("reg10.amend.fromHelp", { d: day(amend.to, locale) }),
          runsTo: t("reg10.amend.to"),
          start: t("reg10.amend.start"),
          startWhy: t("reg10.amend.startWhy"),
          dlgTitle: t("reg10.amend.dlgTitle", { d: amend.decision, p: record.premises.name, c: "{c}" }),
          dlgText: t("reg10.amend.dlgText"),
          dlgBack: t("regops.cancel"),
        }}
        initial={attempt !== null ? { cause: attempt.values.cause, caseRef: attempt.values.caseRef, from: readDate(attempt.values.from) ?? "" } : { cause: "", caseRef: "", from: amend.today }}
        to={amend.to}
        today={amend.today}
        errors={{ cause: causeError, caseRef: caseError, from: fieldError("from") }}
        locale={locale}
      />
    </form>
  );
}

function CaseFileBody({ record, attempt, amendment, t, locale }: { record: CaseFile; attempt: CorrectionAttempt | null; amendment: AmendmentAttempt | null; t: Translate; locale: Locale }) {
  const officer = !record.dataOwner;
  const acts = record.acts;
  return (
    <div style={columns(officer)}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Panel
          title={t("reg10.facts")}
          meta={t("reg10.factsMeta", { rb: record.rulebook })}
          actions={[{ kind: "link", label: t("reg10.useStart"), href: routes.opsUseStarts({ application: record.reference }) }]}
          compact
          locale={locale}
        >
          {record.facts === null ? (
            <Text size="sm" tone="secondary">
              {t("regops.notInData")}
            </Text>
          ) : (
            <FactList items={record.facts.map((fact) => factItem(fact, record.dataOwner, t, locale))} density="console" locale={locale} />
          )}
          {officer && record.facts !== null ? (
            <form id={FORM} action={correctFact.bind(null, record.reference)}>
              <CorrectionPanel
                formId={FORM}
                facts={correctable(record.facts, record.rulebook, t, locale)}
                documents={record.correctionDocuments.map((entry) => ({ value: entry.key, label: t("reg10.docOption", { doc: documentTitle(entry.title, t), digest: entry.digest }) }))}
                words={{
                  open: t("reg10.correct"),
                  fact: t("reg10.corrFact"),
                  title: t("reg10.corrTitle", { fact: "{fact}" }),
                  description: t("reg10.corrDesc", { value: "{value}" }),
                  value: t("reg10.corrValue"),
                  document: t("reg10.corrDoc"),
                  documentHelp: t("reg10.corrDocHelp"),
                  documentNone: t("reg10.docNone"),
                  submit: t("reg10.corrSubmit"),
                  cancel: t("regops.cancel"),
                  confirmTitle: t("reg10.ccTitle", { fact: "{fact}", old: "{old}", new: "{new}" }),
                  confirmText: t("reg10.ccText"),
                  confirmPrimary: t("reg10.ccPrimary", { new: "{new}" }),
                  valueWhy: t("reg10.corrWhy"),
                }}
                heldBy={acts.correct !== null ? holdSentence(t, acts.correct) : null}
                initial={attempt !== null ? attempt.values : null}
                error={attempt !== null && FIELD_CODES.includes(attempt.code) ? refusal(t, attempt.code).text : null}
                locale={locale}
              />
            </form>
          ) : null}
        </Panel>
        <Evidence evidence={record.evidence} t={t} locale={locale} />
        <Panel title={t("reg10.claims")} compact locale={locale}>
          {record.claims.length === 0 ? (
            <Text size="sm" tone="secondary">
              {t("reg10.noClaims")}
            </Text>
          ) : (
            record.claims.map((claim) => <Claim key={claim.id} reference={record.reference} claim={claim} officer={officer} t={t} locale={locale} />)
          )}
        </Panel>
        <Attestations record={record} t={t} locale={locale} />
        <Requests requests={record.requests} t={t} locale={locale} />
        <Dates record={record} t={t} locale={locale} />
        <Panel title={t("reg10.proposals")} compact locale={locale}>
          {record.proposals.length === 0 ? (
            <Text size="sm" tone="secondary">
              {t("reg10.noProposals")}
            </Text>
          ) : (
            [...record.proposals].reverse().map((proposal) => <Proposal key={proposal.id} proposal={proposal} t={t} locale={locale} />)
          )}
        </Panel>
        {record.decision !== null ? (
          <Panel title={t("reg10.decision")} compact locale={locale}>
            <FactList
              items={[
                { label: t("reg10.dRef"), value: record.decision.reference, kind: "id" },
                { label: t("reg10.dOutcome"), value: `${record.decision.status}, ${record.decision.outcome}` },
                { label: t("reg10.dBasis"), value: t(record.decision.asApplied ? "reg10.asApplied" : "reg10.otherwise") },
                { label: t("reg10.dIssued"), value: record.decision.issuedAt, kind: "datetime" },
                { label: t("reg10.dFee"), value: { amountMinor: record.decision.feeMinor, currency: record.decision.currency }, kind: "money" },
                { label: t("reg10.kPeriod"), value: record.decision.period, kind: "period" },
              ]}
              columns={2}
              density="console"
              locale={locale}
            />
          </Panel>
        ) : null}
        {record.ended !== null ? (
          <Panel title={t("reg10.ended")} status={codeStatus(record.ended.kind)} compact locale={locale}>
            <FactList
              items={[
                { label: t("reg10.eOn"), value: record.ended.on, kind: "date" },
                ...(record.ended.cause !== null ? [{ label: t("reg10.eCause"), value: t(`reg10.eCause.${record.ended.cause}`) }] : []),
                ...(record.ended.instruction !== null ? [{ label: t("reg10.eInstruction"), value: record.ended.instruction }] : []),
                ...(record.ended.reason !== null ? [{ label: t("reg10.eReason"), value: record.ended.reason }] : []),
              ]}
              density="console"
              locale={locale}
            />
          </Panel>
        ) : null}
        <Panel title={t("reg10.history")} compact locale={locale}>
          <Table
            columns={[
              { key: "at", label: t("reg10.hAt"), kind: "datetime" },
              { key: "change", label: t("reg10.hChange"), kind: "stack", detailSize: "sm" },
              { key: "cause", label: t("reg10.hCause"), kind: "mono" },
              { key: "by", label: t("reg10.hBy") },
            ]}
            rows={record.transitions.map((move, index) => ({
              _key: `h${String(index)}`,
              at: move.at,
              change: { text: move.to, detail: move.from !== null ? t("reg10.fromState", { s: move.from }) : t("reg10.noState") },
              cause: move.cause,
              by: actorWords(move.by, t),
            }))}
            density="console"
            caption={t("reg10.history")}
            locale={locale}
          />
        </Panel>
      </div>
      {officer ? (
        <Panel as="aside" title={t("reg10.acts")} compact locale={locale}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "var(--space-4)" }}>
            <Act label={t("reg10.reqEv")} held={acts.requestEvidence} href={routes.opsEvidenceRequest(record.reference)} shortcut="Alt+R" primary={false} t={t} locale={locale} />
            <Act label={t("reg10.propose")} held={acts.propose} href={routes.opsDecisionProposal(record.reference)} shortcut="Alt+P" primary t={t} locale={locale} />
            <Act label={t("reg10.withdraw")} held={acts.withdraw} href={routes.opsWithdrawal(record.reference)} shortcut="Alt+W" primary={false} withdraw t={t} locale={locale} />
            <StartAmendment record={record} attempt={amendment} t={t} locale={locale} />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

/** An act of the case file: a link to its screen while its state admits it, otherwise disabled with the sentence that holds it. */
function Act({
  label,
  held,
  href,
  shortcut,
  primary,
  withdraw = false,
  t,
  locale,
}: {
  label: string;
  held: string | null;
  href: ReturnType<typeof routes.opsApplication>;
  shortcut: string;
  primary: boolean;
  withdraw?: boolean;
  t: Translate;
  locale: Locale;
}) {
  return held === null ? (
    <ShortcutButton variant={primary ? "primary" : "secondary"} size="sm" href={href} shortcut={shortcut} fullWidth locale={locale}>
      {label}
    </ShortcutButton>
  ) : (
    <Button variant="secondary" size="sm" disabled disabledReason={holdSentence(t, held, withdraw ? "withdraw" : "act")} fullWidth locale={locale}>
      {label}
    </Button>
  );
}

/** One fact version with its label and class (convention 6), and what it corrects, replaces, comes with or was copied from. */
function factItem(fact: CaseFact, dataOwner: boolean, t: Translate, locale: Locale) {
  const name = t(`reg10.f.${fact.code}`);
  const c = fact.cls;
  const n = String(fact.version);
  let note: string;
  if (fact.correction !== null) {
    const values = { c, n, o: String(fact.correction.corrects), who: fact.correction.by, d: day(fact.correction.on, locale) };
    note = fact.correction.document !== null ? t("reg10.nCorrectedDoc", { ...values, doc: documentInLine(fact.correction.document, t) }) : t("reg10.nCorrected", values);
  } else if (fact.replaced !== null) {
    note = t("reg10.nEarlier", { c, n: String(fact.replaced.by), d: day(fact.replaced.on, locale) });
  } else if (fact.copiedFrom !== null) {
    note = t("reg10.nCopied", { c, n, ref: fact.copiedFrom });
  } else if (fact.document !== null) {
    note = t("reg10.nWith", { c, n, doc: documentInLine(fact.document, t) });
  } else {
    note = t("reg10.nClass", { c, n });
  }
  // The data owner checks each registry value's source (FR-REG-033).
  if (dataOwner && fact.source !== null) note = `${note} ${t("reg10.nSource", { ts: moment(fact.source.at, locale), v: String(fact.source.version) })}`;
  return {
    label: fact.current ? name : t("reg10.fVersion", { f: name, n }),
    value: factValue(fact, t, locale),
    ...(fact.code === "business_registration" ? { kind: "mono" as const } : {}),
    provenance: fact.label,
    note,
  };
}

/** The facts the premises declared, as the correction panel offers them, with how a new value is entered. */
function correctable(facts: readonly CaseFact[], rulebook: string, t: Translate, locale: Locale): CorrectableFact[] {
  return facts
    .filter((fact) => fact.current && fact.label !== "registry-sourced" && (CORRECTABLE as readonly string[]).includes(fact.code))
    .map((fact): CorrectableFact => {
      const base = { code: fact.code, label: t(`reg10.f.${fact.code}`), current: factValue(fact, t, locale) };
      switch (fact.code) {
        case "customer_area":
          return { ...base, entry: { kind: "number", unit: t("regops.m2", { n: "{n}" }), suffix: "m²", helper: t("reg10.areaHelp", { rb: rulebook }) } };
        case "days_open":
          return { ...base, entry: { kind: "number", unit: t("regops.days", { n: "{n}" }), suffix: t("reg10.daysUnit"), helper: t("reg10.daysHelp", { rb: rulebook }) } };
        case "premises_class":
          return { ...base, entry: { kind: "choice", options: CLASSES.map((value) => ({ value, label: t(`regops.class.${value}`) })) } };
        case "music_method":
          return { ...base, entry: { kind: "choice", options: METHODS.map((value) => ({ value, label: t(`regops.music.${value}`) })) } };
        default:
          return { ...base, entry: { kind: "date" } };
      }
    });
}

function Evidence({ evidence, t, locale }: { evidence: readonly CaseEvidence[] | null; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("reg10.evidence")} {...(evidence !== null && evidence.length > 0 ? { description: t("reg10.eDigestHelp") } : {})} compact locale={locale}>
      {evidence === null ? (
        <Text size="sm" tone="secondary">
          {t("regops.notInData")}
        </Text>
      ) : evidence.length === 0 ? (
        <Text size="sm" tone="secondary">
          {t("reg10.noEvidence")}
        </Text>
      ) : (
        <Table
          columns={[
            { key: "doc", label: t("reg10.eDoc"), kind: "strong" },
            { key: "forWhat", label: t("reg10.eFor"), nowrap: true },
            { key: "at", label: t("reg10.eAt") },
            { key: "file", label: t("reg10.eFile"), nowrap: true },
            { key: "digest", label: t("reg10.eDigest"), kind: "mono" },
          ]}
          rows={evidence.map((entry) => ({
            _key: entry.key,
            doc: documentTitle(entry.title, t),
            forWhat:
              "requirement" in entry.answers
                ? entry.answers.requirement
                : "claim" in entry.answers
                  ? t("reg10.forClaim", { kind: entry.answers.claim })
                  : t("reg10.forItem", { n: String(entry.answers.requestItem) }),
            at: entry.receivedAt !== null ? moment(entry.receivedAt, locale) : day(entry.receivedOn, locale),
            file: fileWords(entry.file, t, locale),
            digest: `…${entry.digest}`,
          }))}
          density="console"
          caption={t("reg10.evidence")}
          locale={locale}
        />
      )}
    </Panel>
  );
}

/** A claim, a band of its own with the act that decides it: shown with each claim, enabled while it is in review. */
function Claim({ reference, claim, officer, t, locale }: { reference: string; claim: CaseClaim; officer: boolean; t: Translate; locale: Locale }) {
  const outcome = claim.outcome;
  return (
    <Panel
      variant="sunken"
      title={t("reg10.claimTitle", { kind: claim.kind, layer: layerWords(claim.layer, t) })}
      status={codeStatus(claim.state)}
      {...(officer
        ? {
            actions: [
              claim.state === "UNDER_REVIEW"
                ? { label: t("reg10.claimReview"), variant: "secondary" as const, href: routes.opsClaimReview(reference, claim.id) }
                : { label: t("reg10.claimReview"), variant: "secondary" as const, disabled: true, disabledReason: refusal(t, "ASSERTION_NOT_UNDER_REVIEW").text },
            ],
          }
        : {})}
      level={3}
      compact
      locale={locale}
    >
      <FactList
        items={[
          { label: t("reg10.kPeriod"), value: claim.period, kind: "period" },
          ...(claim.raisedAt !== null ? [{ label: t("reg10.kRaised"), value: claim.raisedAt, kind: "datetime" as const, note: t("reg10.byPrincipal") }] : []),
          ...(outcome !== null
            ? [
                { label: t("reg10.kReason"), value: reasonWords(outcome.reason, locale) },
                ...(outcome.scope !== null ? [{ label: t("reg10.kScope"), value: outcome.scope, kind: "period" as const }] : []),
                {
                  label: t("reg10.kRecorded"),
                  value: outcome.recordedAt,
                  kind: "datetime" as const,
                  note: outcome.legal !== null && outcome.legal !== outcome.recordedBy ? t("reg10.recordedWithLegal", { who: outcome.recordedBy, legal: outcome.legal }) : t("reg10.recordedBy", { who: outcome.recordedBy }),
                },
              ]
            : []),
        ]}
        columns={2}
        density="console"
        locale={locale}
      />
    </Panel>
  );
}

function Attestations({ record, t, locale }: { record: CaseFile; t: Translate; locale: Locale }) {
  const list = record.attestations;
  return (
    <Panel title={t("reg10.attest")} compact locale={locale}>
      {list === null ? (
        <Text size="sm" tone="secondary">
          {t("regops.notInData")}
        </Text>
      ) : list.length === 0 ? (
        <Text size="sm" tone="secondary">
          {t("reg10.noAttest")}
        </Text>
      ) : (
        <Table
          columns={[
            { key: "v", label: t("reg10.aVersion"), kind: "mono" },
            { key: "at", label: t("reg10.aAt"), kind: "datetime" },
            { key: "by", label: t("reg10.aBy"), kind: "stack", detailSize: "sm", minWidth: "var(--space-40)" },
            { key: "expl", label: t("reg10.aExpl") },
            { key: "rules", label: t("reg10.aRules") },
          ]}
          rows={[...list].reverse().map((entry) => ({
            _key: `v${String(entry.version)}`,
            v: entry.superseded ? t("reg10.aSuperseded", { n: String(entry.version) }) : `v${String(entry.version)}`,
            at: entry.at,
            by:
              entry.by.name !== null
                ? { text: entry.by.name, detail: entry.by.party !== null ? t("regops.principalFor", { party: entry.by.party }) : t("regops.actor.PRINCIPAL") }
                : actorWords(entry.by, t),
            expl: String(entry.explanation),
            rules: entry.rulebook,
          }))}
          density="console"
          caption={t("reg10.attest")}
          locale={locale}
        />
      )}
    </Panel>
  );
}

function Requests({ requests, t, locale }: { requests: readonly CaseRequest[] | null; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("reg10.requests")} compact locale={locale}>
      {requests === null ? (
        <Text size="sm" tone="secondary">
          {t("regops.notInData")}
        </Text>
      ) : requests.length === 0 ? (
        <Text size="sm" tone="secondary">
          {t("reg10.noRequest")}
        </Text>
      ) : (
        [...requests].reverse().map((request, index) => (
          <div key={`r${String(index)}`} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <FactList
              items={[
                { label: t("reg10.rState"), value: codeStatus(request.state), kind: "status" },
                { label: t("reg10.rBy"), value: request.by.role === "SYSTEM" ? t("reg10.rByRightOne") : actorWords(request.by, t) },
                { label: t("reg10.rAt"), value: request.at, kind: "datetime" },
                { label: t("reg10.rDue"), value: request.dueOn, kind: "date" },
                // EXC-REG-02: COM issued no notice, so the request does not lapse until one is sent.
                ...(request.notice === "NOT_SENT"
                  ? [{ label: t("reg10.noticeNotSent"), value: { family: "attention" as const, label: t("reg10.noticeNotSent") }, kind: "status" as const, note: t("reg10.noticeNotSentText") }]
                  : []),
              ]}
              columns={2}
              density="console"
              locale={locale}
            />
            <ItemList
              items={request.items.map((item) => ({
                key: item.code,
                title: documentTitle(item.title, t),
                detail: item.code,
                status:
                  item.receivedOn !== null
                    ? { family: "neutral" as const, label: t("reg10.receivedOn", { d: day(item.receivedOn, locale) }) }
                    : { family: "attention" as const, label: t("reg10.notReceived") },
              }))}
              numbered
              readOnly
              density="console"
              label={t("reg10.requestItems")}
              locale={locale}
            />
          </div>
        ))
      )}
    </Panel>
  );
}

function Dates({ record, t, locale }: { record: CaseFile; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("reg10.dates")} compact locale={locale}>
      {record.statements.length === 0 ? (
        <Text size="sm" tone="secondary">
          {t(record.noStatement === "AUTOMATED" ? "reg10.noDatesAuto" : "reg10.noDatesDraft")}
        </Text>
      ) : (
        <Table
          columns={[
            { key: "stated", label: t("reg10.tStated"), kind: "datetime" },
            { key: "complete", label: t("reg10.tComplete"), kind: "date" },
            { key: "expected", label: t("reg10.tExpected"), kind: "stack", detailSize: "sm", minWidth: "var(--space-40)" },
            { key: "deadline", label: t("reg10.tDeadline"), kind: "date" },
          ]}
          rows={record.statements.map((row, index) => {
            const type = reviewTypeWords(row.reviewType, t);
            return {
              _key: `s${String(index)}`,
              stated: row.statedAt,
              complete: row.completeOn,
              expected:
                row.expectedOn !== null
                  ? {
                      text: day(row.expectedOn, locale),
                      detail: t(row.restatedOnAnswer && record.status === "EVIDENCE_REQUIRED" ? "reg10.restated" : "reg10.days21", { type, n: String(row.periodDays) }),
                    }
                  : null,
              deadline: row.deadline,
              ...(row.toldAt !== null ? { _message: { severity: "warning", text: t("reg10.told", { ts: moment(row.toldAt, locale) }) } } : {}),
            };
          })}
          density="console"
          caption={t("reg10.dates")}
          locale={locale}
        />
      )}
    </Panel>
  );
}

/** A proposal, with its statement where it carries one, its fee, and its verdict or who it waits for; it opens on SCR-REG-14. */
function Proposal({ proposal, t, locale }: { proposal: CaseProposal; t: Translate; locale: Locale }) {
  const adverse = proposal.outcome !== "DECIDED_AS_APPLIED";
  const verdict = proposal.verdict;
  return (
    <Panel
      variant="sunken"
      title={proposal.outcome}
      status={codeStatus(proposal.status)}
      actions={[{ kind: "link", label: t("reg10.openProposal"), href: routes.opsApprovals(proposal.id) }]}
      level={3}
      compact
      locale={locale}
    >
      <FactList
        items={[
          ...(adverse
            ? [
                { label: t("reg10.pReason"), value: reasonWords(proposal.reason, locale) },
                { label: t("reg10.pText"), value: proposal.text ?? "" },
                { label: t("reg10.pUnmet"), value: proposal.unmet.join(" ") },
                { label: t("reg10.pCan"), value: proposal.actionOpen ?? "" },
              ]
            : []),
          ...(proposal.feeMinor !== null ? [{ label: t("reg10.pFee"), value: money(proposal.feeMinor, proposal.currency, locale) }] : []),
          { label: t("reg10.pBy"), value: proposal.preparedBy.name, note: moment(proposal.preparedAt, locale) },
          ...(adverse
            ? [
                verdict !== null
                  ? { label: t("reg10.pVerdict"), value: t("reg10.verdictBy", { who: verdict.by, at: moment(verdict.at, locale) }), ...(verdict.note !== null ? { note: verdict.note } : {}) }
                  : { label: t("reg10.pVerdict"), value: null, missing: proposal.status === "PENDING_APPROVAL" ? t("reg10.waiting") : proposal.status },
              ]
            : []),
        ]}
        density="console"
        locale={locale}
      />
    </Panel>
  );
}

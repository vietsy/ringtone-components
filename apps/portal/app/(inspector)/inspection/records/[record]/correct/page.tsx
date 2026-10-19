import { Banner, Columns, FactList, PageHeader, Panel, Skeleton, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { ConsoleFailure, ConsoleFrame } from "@/features/inspection/ConsoleFrame";
import { CorrectionForm } from "@/features/inspection/CorrectionForm";
import { correctRecordAct } from "@/features/inspection/record-actions";
import { challengeText, findingsText, refusalOf, refusalSentence } from "@/features/inspection/words";
import { readForPage } from "@/lib/api/flash";
import {
  FINDING_KINDS,
  FOLLOW_UPS,
  OUTCOMES,
  REFERRAL_ROUTES,
  loadRecordCorrection,
  type CorrectionAttempt,
  type RecordCorrection,
  type RefusalCode,
} from "@/lib/api/inspection";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** The finding kinds that need a note (design/03 SCR-VER-04, and NOTE_REQUIRED for a correction). */
const NEED_NOTE: readonly string[] = ["OTHER", "RECORD_SCOPE_EXCEEDED", "EXTERNAL_LICENCE_PRESENTED"];
/** Header refusals said with Retry; nothing is issued. */
const RETRYABLE = new Set<RefusalCode>(["PREMISES_READ_UNAVAILABLE", "CASE_INTAKE_UNAVAILABLE", "CASE_STATE_UNAVAILABLE", "POLICY_READ_UNAVAILABLE"]);

/**
 * SCR-VER-15 Correct a record. Where the case of a request to reconsider it requires a correction, the issuing
 * authority's inspector records the corrected content as version n+1, with the case and the reason; the version
 * in force is kept, marked superseded, and still readable.
 */
export default async function CorrectRecordPage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  // Signed in as an inspector, or sent to sign in.
  const inspector = await requireInspector();
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const loading = reviewView(query, ["loading"] as const) === "loading";
  const attempt = readForPage<CorrectionAttempt>(query);
  const caseRef = typeof query.case === "string" && query.case !== "" ? query.case : null;
  const outcome = loading ? null : await loadRecordCorrection(inspector.sessionId, record, caseRef, attempt, locale);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <ConsoleFrame account={inspector.account} current="records" keyMap={[{ keys: ["Tab", "Shift+Tab"], label: t("ver15.kTab") }]} t={t} locale={locale}>
      <PageHeader
        crumbs={[{ label: t("console.crumb") }, { label: t("ver18.title"), href: routes.inspectionWork() }]}
        title={data !== null ? t("ver15.title", { r: data.record.reference, n: data.record.version }) : record}
        locale={locale}
      />
      {failure !== null ? (
        failure.code === "RECORD_NOT_FOUND" ? (
          <ViewState
            view="refused"
            refusal={{ ...refusalOf(t, "RECORD_NOT_FOUND"), family: "attention", action: { label: t("ver15.back"), href: routes.inspectionWork(), icon: "arrow-left" } }}
            density="console"
            level={2}
            locale={locale}
          />
        ) : (
          <ConsoleFailure failure={failure} refusals={["NOT_AUTHORISED"]} t={t} locale={locale} />
        )
      ) : (
        <Correction data={data} t={t} locale={locale} />
      )}
    </ConsoleFrame>
  );
}

function Correction({ data, t, locale }: { data: RecordCorrection | null; t: Translate; locale: Locale }) {
  const refusal = data?.refusal ?? null;
  const field = data?.fieldRefusal ?? null;
  const beside = (name: NonNullable<RecordCorrection["fieldRefusal"]>["field"]) => (field?.field === name ? field.code : null);
  const outcomeRefusal = beside("outcome");
  const line = data === null ? null : caseLine(data, t);
  const next = data === null ? 0 : data.record.version + 1;

  return (
    <>
      {refusal !== null && (
        <Banner
          family="attention"
          title={refusalOf(t, refusal).title}
          code={refusal}
          {...(RETRYABLE.has(refusal) ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.inspectionCorrection(data?.record.reference ?? "", data?.draft.caseRef) } } : {})}
          density="console"
          locale={locale}
        >
          {refusalOf(t, refusal).text}
        </Banner>
      )}
      {data !== null && data.already !== null && (
        <Panel density="console" locale={locale}>
          <FactList
            items={[
              { label: t("ver15.lVersion"), value: t("ver13.recordVersion", { r: data.record.reference, n: data.already.version }) },
              { label: t("ver15.lIssued"), value: data.already.issuedAt, kind: "datetime" },
            ]}
            density="console"
            locale={locale}
          />
        </Panel>
      )}
      <Columns>
        <Panel gap="xl" density="console" locale={locale}>
          {data === null || line === null ? (
            <Skeleton variant="card" rows={6} density="console" locale={locale} />
          ) : (
            <CorrectionForm
              action={correctRecordAct}
              record={data.record.reference}
              caseField={{
                title: t("ver15.caseTitle"),
                label: t("ver15.case"),
                value: data.draft.caseRef,
                error: beside("case") !== null ? refusalSentence(t, "CASE_NOT_FOR_RECORD") : null,
                line,
              }}
              outcome={{
                title: t("ver15.outcome"),
                outcome: {
                  legend: t("ver15.outcome"),
                  options: OUTCOMES.map((value) => ({ value, label: t(`ver.outcome.${value}`) })),
                  value: data.draft.outcome ?? "",
                },
                refusal: outcomeRefusal !== null ? refusalOf(t, outcomeRefusal) : null,
                guidance: { label: t("ver05.guidance"), value: data.draft.guidance, error: beside("guidance") !== null ? refusalSentence(t, "GUIDANCE_MISSING") : null },
                referral: {
                  legend: t("ver05.route"),
                  options: REFERRAL_ROUTES.map((value) => ({ value, label: t(`ver.route.${value}`) })),
                  value: data.draft.route,
                  noteLabel: t("ver05.referralNote"),
                  noteValue: data.draft.referralNote,
                  noteError: beside("referralNote") !== null ? refusalSentence(t, "REFERRAL_NOTE_MISSING") : null,
                },
              }}
              findings={{
                legend: t("ver15.findings"),
                rowTitle: t("ver15.findingN"),
                add: t("ver15.addFinding"),
                kind: t("ver15.kind"),
                note: t("ver15.note"),
                kinds: FINDING_KINDS.map((value) => ({ value, label: t(`ver.finding.${value}`) })),
                rows: data.draft.findings.map((finding) => ({ kind: finding.kind ?? "", note: finding.note })),
                needNote: NEED_NOTE,
                noteError: beside("findings") !== null ? refusalSentence(t, "NOTE_REQUIRED") : null,
              }}
              followUp={{
                kind: { label: t("ver15.followUp"), options: FOLLOW_UPS.map((value) => ({ value, label: t(`ver.followUp.${value}`) })), value: data.draft.followUp },
                date: { label: t("ver15.followUpBy"), value: data.draft.followUpBy, error: beside("followUp") !== null ? refusalSentence(t, "FOLLOW_UP_DATE_INVALID") : null },
              }}
              reason={{ label: t("ver15.reason"), value: data.draft.reason }}
              issue={{ label: t("ver15.issue", { n: next }), barred: refusal !== null && !RETRYABLE.has(refusal) ? refusalOf(t, refusal).title : null }}
              cancel={{ label: t("ver.cancel"), href: routes.inspectionWork() }}
              confirm={{ title: t("ver15.dlgTitle"), description: t("ver15.dlgText"), record: t("ver14.lRecord"), outcome: t("ver15.outcome"), case: t("ver15.case") }}
              locale={locale}
            />
          )}
        </Panel>
        {data !== null && (
          <Panel as="aside" title={t("ver15.inForce", { n: data.record.version })} level={2} density="console" locale={locale}>
            <FactList
              items={[
                { label: t("ver06.lAt"), value: data.record.inspectedAt, kind: "datetime" },
                { label: t("ver15.lIssued"), value: data.record.issuedAt, kind: "datetime" },
                { label: t("ver06.lOutcome"), value: t(`ver.outcome.${data.record.outcome}`) },
                { label: t("ver06.lFindings"), value: findingsText(t, data.record.findings, "list"), missing: t("ver06.none") },
                { label: t("ver06.lChallenge"), value: challengeText(t, data.record.challenge) },
              ]}
              density="console"
              locale={locale}
            />
            <Text size="sm" tone="secondary">
              {t("ver15.kept", { n: data.record.version })}
            </Text>
          </Panel>
        )}
      </Columns>
    </>
  );
}

/** What CAS answers for the case named, as the line under the case field says it. */
function caseLine(data: RecordCorrection, t: Translate): { family: "positive" | "attention" | "neutral"; text: string } {
  switch (data.caseLine) {
    case "DECIDED_CORRECTION":
      return { family: "positive", text: t("ver15.caseDecided") };
    case "NOT_DECIDED":
      return { family: "attention", text: refusalOf(t, "CASE_NOT_DECIDED").title };
    case "NOT_FOR_RECORD":
      return { family: "attention", text: refusalOf(t, "CASE_NOT_FOR_RECORD").title };
    case "NO_CORRECTION":
      return { family: "attention", text: refusalOf(t, "CORRECTION_NOT_REQUIRED").title };
    case "ALREADY_RECORDED":
      return { family: "neutral", text: refusalOf(t, "CORRECTION_ALREADY_RECORDED").title };
    case "NONE":
      return { family: "neutral", text: t("ver15.caseNone") };
  }
}

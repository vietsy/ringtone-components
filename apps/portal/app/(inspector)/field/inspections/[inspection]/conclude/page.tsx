import { Banner, Button, ButtonRow, ChoiceList, Divider, FactList, PageHeader, Panel, Select, StatusLine, TextField } from "@/components/r1";
import { issueRecord } from "@/features/inspection/actions";
import { FieldFailure, FieldFrame } from "@/features/inspection/FieldFrame";
import { FollowUpFields } from "@/features/inspection/FollowUpFields";
import { IssueRecordButton } from "@/features/inspection/IssueRecordButton";
import { OutcomeFields } from "@/features/inspection/OutcomeFields";
import { date, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import {
  ACKNOWLEDGEMENTS,
  FOLLOW_UPS,
  OUTCOMES,
  REFERRAL_ROUTES as ROUTES,
  REPRESENTATIVE_ROLES as ROLES,
  currentFieldDevice,
  loadConclusion,
  type Conclusion,
  type ConclusionAttempt,
  type ConclusionDraft,
  type FollowUpKind,
  type RefusalCode,
} from "@/lib/api/inspection";
import { readForPage } from "@/lib/api/flash";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER05_VIEWS } from "@/lib/mock/inspection";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** The follow-ups section 5c words with their date, as the confirmation names them (design/03 section 5c). */
const DATED_WORDS: Readonly<Partial<Record<FollowUpKind, string>>> = { RE_VISIT: "ver05.reVisitBy", AWAIT_REGISTRATION: "ver05.awaitBy" };

/** Header refusals under which no record can be issued: the inspector's authority, or an inspection already ended. */
const NO_ISSUE: readonly RefusalCode[] = ["NO_EFFECTIVE_APPOINTMENT", "APPOINTMENT_SUSPENDED", "AUTHORITY_NOT_ACTIVE", "INSPECTION_NOT_OPEN"];
/** Header refusals that a second send may clear, said with Retry; the inspection stays open. */
const RETRYABLE: readonly RefusalCode[] = [
  "CASE_INTAKE_UNAVAILABLE",
  "CERTIFICATE_READ_UNAVAILABLE",
  "PREMISES_READ_UNAVAILABLE",
  "POLICY_READ_UNAVAILABLE",
];

/** The page's form, which the confirmation dialog sends. */
const FORM_ID = "ver05-conclusion";

/**
 * SCR-VER-05 Conclude the inspection. The inspector records the outcome, the guidance or the referral, the
 * representative and what they said, the follow-up and, when late, why; then issues record version 1, after a
 * confirmation, and the record opens on SCR-VER-06.
 */
export default async function ConcludePage({
  params,
  searchParams,
}: {
  params: Promise<{ inspection: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Signed in as an inspector, or sent to sign in.
  const { sessionId } = await requireInspector();
  const [{ inspection }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, VER05_VIEWS);
  const attempt = readForPage<ConclusionAttempt>(query);
  const outcome = await loadConclusion(sessionId, inspection, view, locale, attempt);
  const data = outcome.data;

  return (
    <FieldFrame device={data?.device ?? currentFieldDevice()} locale={locale}>
      <PageHeader
        title={data !== null ? t("ver05.title", { ref: data.inspection, premises: data.premises }) : inspection}
        {...(data?.lateRecording === true ? { meta: t("ver05.meta", { t: timestamp(data.tookPlaceAt, locale) }) } : {})}
        size="public"
        locale={locale}
      />
      {data === null ? (
        <FieldFailure
          // The screen opens on what SCR-VER-04 already read, so it has no loading state: no data is a failure.
          failure={outcome.failure ?? { code: "INTERNAL_ERROR", traceId: null, retryable: true }}
          refusals={["INSPECTION_NOT_FOUND", "NOT_AUTHORISED"]}
          action={{ for: "INSPECTION_NOT_FOUND", label: t("ver.home"), href: routes.field(), icon: "arrow-left" }}
          t={t}
          locale={locale}
        />
      ) : (
        <Conclude data={data} inspection={inspection} confirmOpen={view === "confirm" || view === "confirm-offline-waiting"} t={t} locale={locale} />
      )}
    </FieldFrame>
  );
}

function Conclude({
  data,
  inspection,
  confirmOpen,
  t,
  locale,
}: {
  data: Conclusion;
  /** The inspection the route names, which the record is issued for. */
  inspection: string;
  confirmOpen: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { draft, refusal } = data;
  const offline = data.device.network === "offline";
  const readAt = data.device.readAt;
  const locked = offline || (refusal !== null && NO_ISSUE.includes(refusal));
  const issueWhy = offline ? t("ver05.offlineWhy") : locked && refusal !== null ? refusalOf(t, refusal).title : null;
  const waiting = data.offlineResultWaiting;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      {offline && (
        <StatusLine
          family="info"
          text={t("ver.noNetworkTitle")}
          detail={readAt !== null ? `${t("ver.noNetwork")} ${t("ver.readAt", { t: timestamp(readAt, locale) })}` : t("ver.noNetwork")}
          locale={locale}
        />
      )}
      {refusal !== null && (
        <Banner
          // An ended inspection is a fact about it, not a fault: the board draws it neutral.
          family={refusal === "INSPECTION_NOT_OPEN" ? "neutral" : "attention"}
          title={refusalOf(t, refusal).title}
          code={refusal}
          {...(RETRYABLE.includes(refusal)
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.fieldConclude(inspection) } }
            : {})}
          density="portal"
          locale={locale}
        >
          {refusalOf(t, refusal).text}
        </Banner>
      )}
      {refusal === "INSPECTION_NOT_OPEN" && data.record !== null && (
        <Panel inset="sm" density="portal" locale={locale}>
          <FactList items={[{ label: t("ver.recordRef"), value: data.record, kind: "id" }]} locale={locale} />
        </Panel>
      )}

      <form id={FORM_ID} action={issueRecord.bind(null, inspection)} style={{ display: "contents" }}>
        <Panel gap="xl" inset="sm" density="portal" locale={locale}>
          <Panel variant="plain" title={t("ver05.outcome")} level={2} gap="md" density="portal" locale={locale}>
            <OutcomeFields
              outcome={{
                legend: t("ver05.outcome"),
                value: draft.outcome ?? "",
                options: OUTCOMES.map((value) => ({
                  value,
                  label: t(`ver.outcome.${value}`),
                  // While a result checked offline for this inspection waits to upload, the record cannot say compliant.
                  ...(value === "COMPLIANT" && waiting !== null ? { disabled: true, reason: t("ver05.offlineWaiting", { rep: waiting }) } : {}),
                })),
              }}
              refusal={draft.outcomeRefusal !== null ? refusalOf(t, draft.outcomeRefusal) : null}
              guidance={{
                label: t("ver05.guidance"),
                value: draft.guidance,
                error: draft.guidanceRefusal !== null ? refusalSentence(t, draft.guidanceRefusal) : null,
              }}
              referral={{
                legend: t("ver05.route"),
                options: ROUTES.map((value) => ({ value, label: t(`ver.route.${value}`) })),
                value: draft.route,
                noteLabel: t("ver05.referralNote"),
                noteValue: draft.referralNote,
                noteError: draft.referralNoteRefusal !== null ? refusalSentence(t, draft.referralNoteRefusal) : null,
              }}
              locale={locale}
            />
          </Panel>
          <Divider />
          <Panel variant="plain" title={t("ver05.representative")} level={2} gap="md" density="portal" locale={locale}>
            <Select
              label={t("ver05.role")}
              name="representative_role"
              options={ROLES.map((value) => ({ value, label: t(`ver.role.${value}`) }))}
              {...(draft.representativeRole !== null ? { value: draft.representativeRole } : {})}
              placeholder={t("ver05.choose")}
              {...(draft.roleRefusal !== null ? { error: refusalSentence(t, draft.roleRefusal) } : {})}
              density="portal"
              locale={locale}
            />
            <ChoiceList
              legend={t("ver05.ack")}
              name="acknowledgement"
              options={ACKNOWLEDGEMENTS.map((value) => ({ value, label: t(`ver.ack.${value}`) }))}
              value={draft.acknowledgement ?? ""}
              required
              density="portal"
              locale={locale}
            />
            <TextField
              label={t("ver05.statement")}
              name="party_statement"
              value={draft.statement}
              multiline
              rows={3}
              maxLength={4000}
              density="portal"
              locale={locale}
            />
          </Panel>
          <Divider />
          <Panel variant="plain" title={t("ver05.followUp")} level={2} gap="md" density="portal" locale={locale}>
            {data.lateRecording && (
              <TextField
                label={t("ver05.delay")}
                name="delay_reason"
                value={draft.delayReason}
                {...(draft.delayRefusal !== null ? { error: refusalSentence(t, draft.delayRefusal) } : {})}
                multiline
                rows={2}
                required
                maxLength={1000}
                density="portal"
                locale={locale}
              />
            )}
            <FollowUpFields
              kind={{
                label: t("ver05.followUp"),
                options: FOLLOW_UPS.map((value) => ({ value, label: t(`ver.followUp.${value}`) })),
                value: draft.followUp,
              }}
              date={{
                label: t("ver05.followUpBy"),
                value: draft.followUpBy,
                error: draft.followUpRefusal !== null ? refusalSentence(t, draft.followUpRefusal) : null,
              }}
              locale={locale}
            />
          </Panel>
          <Divider />
          <ButtonRow>
            <IssueRecordButton
              formId={FORM_ID}
              trigger={{ label: t("ver05.issue"), ...(issueWhy !== null ? { disabledReason: issueWhy } : {}) }}
              dialog={
                waiting !== null
                  ? // Something checked offline would be left out of the record: the dialog asks that first.
                    { title: t("ver05.askTitle"), description: t("ver05.askText", { rep: waiting }), issue: t("ver05.issue"), cancel: t("ver.cancel") }
                  : { title: t("ver05.dlgTitle"), description: t("ver05.dlgText"), issue: t("ver05.issue"), cancel: t("ver.cancel") }
              }
              words={{
                outcome: t("ver05.outcome"),
                route: t("ver05.route"),
                followUp: t("ver05.followUp"),
                outcomes: Object.fromEntries(OUTCOMES.map((value) => [value, t(`ver.outcome.${value}`)])),
                routes: Object.fromEntries(ROUTES.map((value) => [value, t(`ver.route.${value}`)])),
                followUps: Object.fromEntries(FOLLOW_UPS.map((value) => [value, t(`ver.followUp.${value}`)])),
                dated: Object.fromEntries(Object.entries(DATED_WORDS).flatMap(([value, key]) => (key === undefined ? [] : [[value, t(key)]]))),
              }}
              initialFacts={dialogFacts(draft, t, locale)}
              defaultOpen={confirmOpen && issueWhy === null}
              locale={locale}
            />
            <Button variant="quiet" size="md" icon="arrow-left" fullWidth href={routes.fieldInspection(inspection)} locale={locale}>
              {t("ver05.back")}
            </Button>
          </ButtonRow>
        </Panel>
      </form>
    </div>
  );
}

/** What the confirmation names when it is open on arrival: the outcome, the route of a referral, the follow-up with its date. */
function dialogFacts(draft: ConclusionDraft, t: Translate, locale: Locale): { label: string; value: string }[] {
  const dated = draft.followUpBy === "" ? undefined : DATED_WORDS[draft.followUp];
  return [
    { label: t("ver05.outcome"), value: draft.outcome !== null ? t(`ver.outcome.${draft.outcome}`) : "" },
    ...(draft.outcome === "REFERRED" ? [{ label: t("ver05.route"), value: t(`ver.route.${draft.route}`) }] : []),
    {
      label: t("ver05.followUp"),
      value: dated !== undefined ? t(dated, { d: date(draft.followUpBy, locale) }) : t(`ver.followUp.${draft.followUp}`),
    },
  ];
}

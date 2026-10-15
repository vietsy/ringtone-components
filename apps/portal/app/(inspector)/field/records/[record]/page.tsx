import type { ComponentProps } from "react";
import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, ButtonRow, DateField, FactList, PageHeader, Panel, Select, Skeleton, StatusLine } from "@/components/r1";
import { recordHandover } from "@/features/inspection/actions";
import { FieldFailure, FieldFrame } from "@/features/inspection/FieldFrame";
import { PrintButton } from "@/features/inspection/PrintButton";
import { date, joined, premisesAt, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import {
  REPRESENTATIVE_ROLES as ROLES,
  currentFieldDevice,
  loadInspectionRecord,
  type HandoverAttempt,
  type InspectionRecord,
  type RefusalCode,
} from "@/lib/api/inspection";
import { readForPage } from "@/lib/api/flash";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER06_READERS, VER06_VIEWS } from "@/lib/mock/inspection";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type Facts = ComponentProps<typeof FactList>["items"];
type Whole = NonNullable<InspectionRecord["whole"]>;
/** Header refusals under which no handover can be recorded. */
const NO_ACTS: readonly RefusalCode[] = ["NO_EFFECTIVE_APPOINTMENT", "APPOINTMENT_SUSPENDED", "AUTHORITY_NOT_ACTIVE"];
/** Header refusals said with Retry. */
const RETRYABLE: readonly RefusalCode[] = ["PREMISES_READ_UNAVAILABLE", "POLICY_READ_UNAVAILABLE"];

/**
 * SCR-VER-06 Inspection record. Any inspector reads a record by its reference: the issuing authority the whole
 * record, any other authority its confirmation only. The issuing authority records that a copy was handed over
 * and prints one.
 */
export default async function InspectionRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ record: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Signed in as an inspector, or sent to sign in.
  const { sessionId } = await requireInspector();
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, VER06_VIEWS);
  // Who reads it is a second axis of the canvas, reachable as ?reader=other for review, like ?view=; the
  // session's own reader is decided by its appointments.
  const reader = reviewView({ view: query.reader }, VER06_READERS);
  const attempt = readForPage<HandoverAttempt>(query);
  const outcome = view === "loading" ? null : await loadInspectionRecord(sessionId, record, view, reader, locale, attempt);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <FieldFrame device={data?.device ?? currentFieldDevice()} locale={locale}>
      <PageHeader
        title={
          data !== null
            ? t("ver06.title", { r: data.reference, n: R1_FORMAT.formatCount(data.version, locale) ?? "", p: data.premises.name })
            : record
        }
        {...(data !== null
          ? {
              ...(data.versionInForce ? { status: { family: "info" as const, label: t("ver06.versionInForce") } } : {}),
              meta: t("ver06.issued", { t: timestamp(data.issuedAt, locale) }),
            }
          : {})}
        size="public"
        locale={locale}
      />
      {failure !== null ? (
        <FieldFailure
          failure={failure}
          refusals={["RECORD_NOT_FOUND", "NOT_AUTHORISED"]}
          action={{ for: "RECORD_NOT_FOUND", label: t("ver.home"), href: routes.field(), icon: "arrow-left" }}
          t={t}
          locale={locale}
        />
      ) : data === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
          <Panel inset="sm" density="portal" locale={locale}>
            <Skeleton variant="facts" rows={8} density="portal" locale={locale} />
          </Panel>
          {/* Nothing is printed before the record is read; the way out stays. */}
          <ButtonRow>
            <Button variant="quiet" size="md" icon="x" fullWidth href={routes.field()} locale={locale}>
              {t("ver06.close")}
            </Button>
          </ButtonRow>
        </div>
      ) : (
        <Record data={data} reference={record} t={t} locale={locale} />
      )}
    </FieldFrame>
  );
}

function Record({ data, reference, t, locale }: { data: InspectionRecord; reference: string; t: Translate; locale: Locale }) {
  const { refusal, whole } = data;
  const offline = data.device.network === "offline";
  const readAt = data.device.readAt;

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
          family="attention"
          title={refusalOf(t, refusal).title}
          code={refusal}
          {...(RETRYABLE.includes(refusal)
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.fieldRecord(reference) } }
            : {})}
          density="portal"
          locale={locale}
        >
          {refusalOf(t, refusal).text}
        </Banner>
      )}

      <Panel inset="sm" density="portal" locale={locale}>
        <FactList items={whole !== null ? wholeFacts(data, whole, t, locale) : confirmationFacts(data, t, locale)} locale={locale} />
      </Panel>
      {whole === null && <StatusLine family="neutral" text={t("ver06.onlyIssuing")} locale={locale} />}

      {whole !== null && <Delivery data={data} whole={whole} reference={reference} offline={offline} t={t} locale={locale} />}

      <ButtonRow>
        {whole !== null && (
          <PrintButton label={t("ver06.print")} variant={whole.delivery.state === "HANDED_OVER" ? "primary" : "secondary"} locale={locale} />
        )}
        <Button variant="quiet" size="md" icon="x" fullWidth href={routes.field()} locale={locale}>
          {t("ver06.close")}
        </Button>
      </ButtonRow>
    </div>
  );
}

/** The delivery of the record to the premises, and the handover form while it has not reached them. */
function Delivery({
  data,
  whole,
  reference,
  offline,
  t,
  locale,
}: {
  data: InspectionRecord;
  whole: Whole;
  reference: string;
  offline: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { delivery } = whole;
  const handedOver = delivery.state === "HANDED_OVER";
  const blocked = data.refusal !== null && NO_ACTS.includes(data.refusal) ? data.refusal : null;
  const handWhy = offline
    ? t("ver06.offlineWhy")
    : blocked !== null
      ? refusalOf(t, blocked).title
      : data.deliveryRefusal === "NOT_ISSUING_AUTHORITY"
        ? refusalOf(t, data.deliveryRefusal).title
        : null;
  const off = handWhy !== null ? { disabled: true, disabledReason: handWhy } : {};
  const handover = data.handover;

  return (
    <Panel title={t("ver06.delivery")} level={2} inset="sm" gap="lg" density="portal" locale={locale}>
      <FactList
        items={[
          {
            label: t("ver06.lState"),
            value:
              handedOver && delivery.handedOverAt !== null
                ? t("ver06.handed", { t: timestamp(delivery.handedOverAt, locale) })
                : t("ver06.pending"),
          },
          { label: t("ver06.lDue"), value: delivery.dueBy, kind: "datetime" },
          // The board draws only a notice not yet sent.
          { label: t("ver06.lNotice"), value: t("ver06.notice") },
        ]}
        locale={locale}
      />
      {handedOver && delivery.handedOverAt !== null && data.deliveryRefusal === null && (
        <StatusLine family="positive" text={t("ver06.handedShort", { t: timestamp(delivery.handedOverAt, locale) })} locale={locale} />
      )}
      {data.deliveryRefusal !== null && (
        <Banner family="attention" title={refusalOf(t, data.deliveryRefusal).title} code={data.deliveryRefusal} density="portal" locale={locale}>
          {refusalOf(t, data.deliveryRefusal).text}
        </Banner>
      )}
      {!handedOver && (
        // display: contents keeps the fields in the panel's own rhythm; the form only carries them to the action.
        <form action={recordHandover.bind(null, reference)} style={{ display: "contents" }}>
          <DateField
            label={t("ver06.handedAt")}
            name="handed_over_at"
            withTime
            value={handover.on}
            time={handover.time}
            {...(handover.refusal !== null ? { error: refusalSentence(t, handover.refusal) } : {})}
            required
            {...off}
            density="premises"
            locale={locale}
          />
          <Select
            label={t("ver06.recipient")}
            name="recipient_role"
            options={ROLES.map((value) => ({ value, label: t(`ver.role.${value}`) }))}
            {...(handover.recipient !== null ? { value: handover.recipient } : {})}
            placeholder={t("ver05.choose")}
            required
            {...off}
            density="portal"
            locale={locale}
          />
          <Button type="submit" variant="primary" size="lg" icon="check" fullWidth {...off} locale={locale}>
            {t("ver06.record")}
          </Button>
        </form>
      )}
    </Panel>
  );
}

/** The whole record, for the issuing authority: every field as issued, in the words of section 5c. */
function wholeFacts(data: InspectionRecord, whole: Whole, t: Translate, locale: Locale): Facts {
  const corrected = whole.correctedUnderCase;
  return [
    { label: t("ver06.lAuthority"), value: data.authority },
    { label: t("ver06.lInspector"), value: t("ver06.inspector", { name: whole.inspector.name, card: whole.inspector.card }) },
    { label: t("ver06.lPremises"), value: premisesAt(t, data.premises) },
    { label: t("ver06.lAt"), value: whole.inspectedAt, kind: "datetime" },
    { label: t("ver06.lRecorded"), value: data.issuedAt, kind: "datetime" },
    {
      label: t("ver06.lVerified"),
      value: whole.answer !== null ? t("ver06.verified", { answer: whole.answer.reference, state: t("ver.inForce") }) : null,
      missing: t("ver06.none"),
    },
    {
      label: t("ver06.lFindings"),
      value:
        whole.findings.length > 0
          ? joined(
              t,
              whole.findings.map((finding) =>
                finding.note !== null ? t("ver06.finding", { kind: t(`ver.finding.${finding.kind}`), note: finding.note }) : t(`ver.finding.${finding.kind}`),
              ),
            )
          : null,
      missing: t("ver06.none"),
    },
    { label: t("ver06.lOutcome"), value: t(`ver.outcome.${data.outcome}`) },
    ...(corrected !== null ? [{ label: t("ver06.lCorrection"), value: corrected, kind: "id" as const }] : []),
    {
      label: t("ver06.lRep"),
      // Nobody present: the record says so, with no role.
      value:
        whole.representative.role !== null
          ? t("ver06.rep", { role: t(`ver.role.${whole.representative.role}`), ack: t(`ver06.ack.${whole.representative.acknowledgement}`) })
          : t(`ver.ack.${whole.representative.acknowledgement}`),
    },
    { label: t("ver06.lFollow"), value: followUp(whole, t, locale) },
    { label: t("ver06.lChallenge"), value: challenge(data, t) },
    { label: t("ver06.lDigest"), value: data.digest, kind: "mono" },
  ];
}

/** Another authority's inspector reads the confirmation only: no person, no finding, no representative. */
function confirmationFacts(data: InspectionRecord, t: Translate, locale: Locale): Facts {
  return [
    { label: t("ver06.lVersion"), value: R1_FORMAT.formatCount(data.version, locale) ?? "" },
    { label: t("ver06.lRecorded"), value: data.issuedAt, kind: "datetime" },
    { label: t("ver06.lAuthority"), value: data.authority },
    { label: t("ver06.lOutcome"), value: t(`ver.outcome.${data.outcome}`) },
    { label: t("ver06.lChallenge"), value: challenge(data, t) },
    { label: t("ver06.lDigest"), value: data.digest, kind: "mono" },
  ];
}

/** The follow-up in the words of section 5c, with its date where it runs to one. */
function followUp(whole: Whole, t: Translate, locale: Locale): string {
  const by = whole.followUpBy;
  if (by !== null && whole.followUp === "RE_VISIT") return t("ver05.reVisitBy", { d: date(by, locale) });
  if (by !== null && whole.followUp === "AWAIT_REGISTRATION") return t("ver05.awaitBy", { d: date(by, locale) });
  return t(`ver.followUp.${whole.followUp}`);
}

/** Whether the premises asked to reconsider the record, or that it cannot be told just now. */
function challenge(data: InspectionRecord, t: Translate): string {
  return data.reconsideration === "UNKNOWN" ? t("ver06.unknown") : t("ver06.no");
}

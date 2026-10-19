import type { ComponentProps } from "react";
import { Banner, Button, ButtonRow, FactList, PageHeader, Panel, Skeleton, StatusLine, VerificationResult, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { inspectThisPremises } from "@/features/inspection/actions";
import { FieldFrame } from "@/features/inspection/FieldFrame";
import { isCurrentState, joined, premisesAt, refusalOf, splitSentence, stateWords, timestamp, timestampToSecond } from "@/features/inspection/words";
import {
  currentFieldDevice,
  loadVerificationAnswer,
  type AnswerOutcome,
  type RefusalCode,
  type VerificationAnswer,
} from "@/lib/api/inspection";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER02_VIEWS } from "@/lib/mock/inspection";
import { requireInspector } from "@/lib/api/session";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type Facts = NonNullable<ComponentProps<typeof VerificationResult>["facts"]>;

/** Refusals that replace the answer; the page keeps its way on. */
const IN_PLACE: readonly RefusalCode[] = ["ANSWER_NOT_FOUND", "PAYLOAD_REFERENCE_MISMATCH", "NOT_AUTHORISED"];
/** Refusals said in the page header, with the way on under them. */
const IN_HEADER: readonly RefusalCode[] = ["NO_EFFECTIVE_APPOINTMENT", "APPOINTMENT_SUSPENDED", "AUTHORITY_NOT_ACTIVE", "PREMISES_READ_UNAVAILABLE"];

/**
 * SCR-VER-02 Verification answer. One answer as the register gave it: the state in words as its heading for a
 * current result, the outcome and what to do next for any other, the facts, the read instant, and the statement
 * that a code proves who issued the record, not where it was scanned. The online answer is a P3 capability.
 */
export default async function AnswerPage({
  params,
  searchParams,
}: {
  params: Promise<{ answer: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Signed in as an inspector, or sent to sign in.
  const { sessionId } = await requireInspector();
  const [{ answer }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, VER02_VIEWS);
  const outcome = view === "loading" ? null : await loadVerificationAnswer(sessionId, answer, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <FieldFrame device={data?.device ?? currentFieldDevice()} locale={locale}>
      {outcome === null ? (
        <>
          <VerificationResult recordNoun={t("ver.recordNoun")} result="checking" level={1} locale={locale} />
          <Skeleton variant="facts" rows={4} density="portal" locale={locale} />
        </>
      ) : failure !== null || data === null ? (
        <Refused failure={failure} answer={answer} t={t} locale={locale} />
      ) : (
        <Answer data={data} t={t} locale={locale} />
      )}
    </FieldFrame>
  );
}

/** A failure in the answer's place: a refusal in its own words with its code, or our error with its trace. */
function Refused({
  failure,
  answer,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean } | null;
  answer: string;
  t: Translate;
  locale: Locale;
}) {
  const inPlace = IN_PLACE.find((code) => code === failure?.code);
  const inHeader = IN_HEADER.find((code) => code === failure?.code);
  const traceId = failure?.traceId ?? null;
  const header = <PageHeader title={t("ver02.answerTitle")} size="public" locale={locale} />;
  if (inHeader !== undefined) {
    const refusal = refusalOf(t, inHeader);
    return (
      <>
        {header}
        <Banner
          family="attention"
          title={refusal.title}
          code={refusal.code}
          {...(inHeader === "PREMISES_READ_UNAVAILABLE"
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", href: routes.fieldAnswer(answer) } }
            : {})}
          density="portal"
          locale={locale}
        >
          {refusal.text}
        </Banner>
        <Actions answer={null} inspection={null} inspect={{ off: true, why: t("ver02.noPremises") }} t={t} locale={locale} />
      </>
    );
  }
  if (inPlace !== undefined) {
    return (
      <>
        {header}
        <ViewState view="refused" refusal={{ ...refusalOf(t, inPlace), family: "attention" }} density="portal" level={2} locale={locale} />
        {inPlace !== "NOT_AUTHORISED" && (
          <Actions answer={null} inspection={null} inspect={{ off: true, why: t("ver02.noPremises") }} t={t} locale={locale} />
        )}
      </>
    );
  }
  return (
    <>
      {header}
      <ViewState
        view="error"
        errorTitle={t("ver.errTitle")}
        errorText={t("ver.errText")}
        {...(traceId !== null ? { traceId } : {})}
        retryable={failure?.retryable ?? true}
        density="portal"
        level={2}
        locale={locale}
      />
    </>
  );
}

function Answer({ data, t, locale }: { data: VerificationAnswer; t: Translate; locale: Locale }) {
  const outcome = data.outcome;
  const inspection = data.inspection;
  const line =
    inspection === null
      ? null
      : inspection.attached
        ? { family: "positive" as const, text: t("ver02.attached", { i: inspection.reference }) }
        : outcome.kind === "LIMITED_OFFLINE"
          ? { family: "info" as const, text: t("ver02.willAttach") }
          : null;
  const attachRefusal = data.attachRefusal !== null ? refusalOf(t, data.attachRefusal) : null;

  if (outcome.kind === "LIMITED_OFFLINE") {
    // Drawn apart from the online answer and never with its component (design/03 SCR-VER-02, Partial).
    return (
      <>
        <PageHeader title={t("ver02.offlineHeading")} size="public" locale={locale} />
        <Banner family="attention" density="portal" locale={locale}>
          {t("ver02.offlineBody", { p: timestamp(outcome.printedAt, locale), k: timestamp(outcome.keysRefreshedAt, locale) })}
        </Banner>
        {/* A code printed under a key since retired still verifies under it (AC-FR-VER-017-01). */}
        {outcome.keyRetiredAt !== null && (
          <StatusLine family="info" text={t("ver02.keyRetired", { k: outcome.keyId, t: timestamp(outcome.keyRetiredAt, locale) })} locale={locale} />
        )}
        <Panel inset="sm" density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("ver02.lRecord"), value: outcome.record, kind: "id" },
              { label: t("ver02.lPremises"), value: premisesAt(t, outcome.premises) },
              { label: t("ver02.lPrintedState"), value: stateWords(t, outcome.printedState, outcome.period.from, locale) },
              { label: t("ver02.lScope"), value: t("ver.scope") },
              { label: t("ver02.lPeriod"), value: outcome.period, kind: "period" },
              { label: t("ver02.lPrintedAt"), value: outcome.printedAt, kind: "datetime" },
              { label: t("ver02.lKeys"), value: outcome.keysRefreshedAt, kind: "datetime" },
            ]}
            locale={locale}
          />
        </Panel>
        {line !== null && <StatusLine family={line.family} text={line.text} locale={locale} />}
        <Text size="base">{t("ver02.statement")}</Text>
        {data.reference !== null && (
          <Panel inset="sm" density="portal" locale={locale}>
            <FactList items={[{ label: t("ver02.lAnswer"), value: data.reference, kind: "id" }]} locale={locale} />
          </Panel>
        )}
        {/* Uploaded, an offline answer names the premises an inspection can start from; on the phone it waits to upload. */}
        <Actions
          answer={data.reference}
          inspection={inspection}
          inspect={data.reference !== null ? { off: false } : { off: true, why: t("ver02.notUploaded") }}
          t={t}
          locale={locale}
        />
      </>
    );
  }

  const shown = present(outcome, data.reference, t, locale);
  return (
    <>
      <VerificationResult
        recordNoun={t("ver.recordNoun")}
        result={shown.result}
        {...(shown.family !== null ? { family: shown.family } : {})}
        title={shown.title}
        {...(shown.recordId !== null ? { recordId: shown.recordId } : {})}
        {...(shown.facts !== null ? { facts: shown.facts } : {})}
        level={1}
        locale={locale}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Text size="base">{shown.text}</Text>
          {shown.superseded && <StatusLine family="attention" text={t("ver02.superseded")} locale={locale} />}
          {shown.fieldSet !== null && <StatusLine family="info" text={shown.fieldSet} locale={locale} />}
          {shown.next !== null && (
            <div>
              <Button
                variant="secondary"
                size="md"
                icon={shown.next.icon}
                fullWidth
                {...(shown.next.href !== null ? { href: shown.next.href } : {})}
                {...(shown.next.disabledReason !== null ? { disabled: true, disabledReason: shown.next.disabledReason } : {})}
                locale={locale}
              >
                {shown.next.label}
              </Button>
            </div>
          )}
        </div>
      </VerificationResult>
      {line !== null && <StatusLine family={line.family} text={line.text} locale={locale} />}
      {attachRefusal !== null && (
        <Banner family="attention" title={attachRefusal.title} code={attachRefusal.code} density="portal" locale={locale}>
          {attachRefusal.text}
        </Banner>
      )}
      {shown.statement && <Text size="base">{t("ver02.statement")}</Text>}
      {data.reference !== null && (
        <Panel inset="sm" density="portal" locale={locale}>
          <FactList items={[{ label: t("ver02.lAnswer"), value: data.reference, kind: "id" }]} locale={locale} />
        </Panel>
      )}
      <Actions answer={data.reference} inspection={inspection} inspect={shown.inspect} t={t} locale={locale} />
    </>
  );
}

interface Shown {
  result: "valid" | "answer";
  family: "attention" | "neutral" | null;
  title: string;
  text: string;
  recordId: string | null;
  facts: Facts | null;
  superseded: boolean;
  fieldSet: string | null;
  next: { label: string; icon: string; href: string | null; disabledReason: string | null } | null;
  /** The statement that a code is not proof of presence. */
  statement: boolean;
  inspect: { off: false } | { off: true; why: string };
}

/**
 * One answer in the words of sections 5 and 5b: only a current result is headed by the state; every other outcome
 * is headed by its first sentence, the rest under it.
 */
function present(
  outcome: Exclude<AnswerOutcome, { kind: "LIMITED_OFFLINE" }>,
  reference: string | null,
  t: Translate,
  locale: Locale,
): Shown {
  const noPremises = { off: true as const, why: t("ver02.noPremises") };
  const words = (sentence: string, family: "attention" | "neutral", rest: Partial<Shown> = {}): Shown => ({
    result: "answer",
    family,
    ...splitSentence(sentence),
    recordId: null,
    facts: null,
    superseded: false,
    fieldSet: null,
    next: null,
    statement: true,
    inspect: noPremises,
    ...rest,
  });
  switch (outcome.kind) {
    case "CURRENT_RESULT": {
      const state = stateWords(t, outcome.state, outcome.period.from, locale);
      const current = isCurrentState(outcome.state);
      const since = outcome.stateSince;
      const facts: Facts = [
        ...(outcome.premises !== null ? [{ label: t("ver02.lPremises"), value: premisesAt(t, outcome.premises) }] : []),
        // A state since a day, where the source gives no moment, is said as a date; one not known is left out.
        ...(since !== null ? [{ label: t("ver02.lSince"), value: since, kind: since.length > 10 ? ("datetime" as const) : ("date" as const) }] : []),
        { label: t("ver02.lScope"), value: t("ver.scope") },
        { label: t("ver02.lPeriod"), value: outcome.period, kind: "period" },
        { label: t("ver02.lReadAt"), value: timestampToSecond(outcome.readAt, locale) },
      ];
      const outside = outcome.publicFieldSetReason === "OUTSIDE_JURISDICTION";
      return {
        result: current ? "valid" : "answer",
        family: current ? null : "attention",
        title: state,
        text: `${t("ver02.online", { s: state })} ${t("ver02.authentic")}`,
        recordId: outcome.record,
        facts,
        superseded: !outcome.representationCurrent,
        fieldSet: outside ? t("ver02.outside") : null,
        next: null,
        statement: true,
        inspect: outside ? { off: true, why: splitSentence(t("ver02.outside")).title } : { off: false },
      };
    }
    case "UNABLE_TO_VERIFY":
      return outcome.cause === "SYSTEM"
        ? words(t("ver02.unable"), "attention", {
            next: {
              label: t("ver.retry"),
              icon: "refresh-cw",
              href: reference !== null ? routes.fieldAnswer(reference) : null,
              disabledReason: null,
            },
          })
        : words(t("ver02.offlineKeys"), "attention", {
            next: { label: t("ver02.refresh"), icon: "key-round", href: null, disabledReason: t("ver02.refreshOff") },
            inspect: { off: true, why: t("ver02.notUploaded") },
          });
    case "INVALID_INPUT":
      return words(t("ver02.invalid"), "attention", {
        facts:
          outcome.expectedFormat !== null
            ? [{ label: t("ver02.lFormat"), value: outcome.expectedFormat, kind: "mono" }]
            : [{ label: t("ver02.lTypes"), value: joined(t, outcome.usableTypes.map((type) => t(`ver.identifierType.${type}`))) }],
        statement: false,
      });
    case "NO_RECORD":
      return words(t("ver02.noRecord"), "neutral", { statement: false });
    case "NO_PREMISES_IN_JURISDICTION":
      return words(t("ver02.noPremisesInJ"), "neutral", { statement: false });
    case "NO_CURRENT_RECORD_FOR_PREMISES":
      return words(noCurrent(outcome, t, locale), "neutral", {
        statement: false,
        inspect: { off: false },
      });
    case "AMBIGUOUS":
      return words(t("ver02.ambiguous", { n: outcome.count }), "attention", { statement: false });
    case "NOT_AUTHENTICATED":
      return words(t("ver02.notAuth"), "attention");
  }
}

/** The no-current-record sentence with the premises' last known state: never issued, or the state in words (5b). */
function noCurrent(outcome: Extract<AnswerOutcome, { kind: "NO_CURRENT_RECORD_FOR_PREMISES" }>, t: Translate, locale: Locale): string {
  const named = { p: outcome.premises.name, a: outcome.premises.address ?? "" };
  if (outcome.lastState === null) return t("ver02.noCurrent", named);
  // The state's words continue the sentence, so they start in lower case.
  const words = stateWords(t, outcome.lastState, null, locale);
  return t("ver02.noCurrentLast", { ...named, s: words.charAt(0).toLocaleLowerCase(locale) + words.slice(1) });
}

/** Back to the inspection the answer was verified from, or Inspect this premises; then Scan another. */
function Actions({
  answer,
  inspection,
  inspect,
  t,
  locale,
}: {
  /** The stored answer Inspect this premises carries into SCR-VER-03; null where there is none to carry. */
  answer: string | null;
  inspection: VerificationAnswer["inspection"];
  inspect: Shown["inspect"];
  t: Translate;
  locale: Locale;
}) {
  const inspectButton = (
    <Button
      type={inspect.off || answer === null ? "button" : "submit"}
      variant={inspect.off ? "secondary" : "primary"}
      size="lg"
      icon="building-2"
      fullWidth
      {...(inspect.off ? { disabled: true, disabledReason: inspect.why } : {})}
      locale={locale}
    >
      {t("ver02.inspect")}
    </Button>
  );
  return (
    <ButtonRow>
      {inspection !== null ? (
        <Button variant="primary" size="lg" icon="arrow-left" fullWidth href={routes.fieldInspection(inspection.reference)} locale={locale}>
          {t("ver02.back")}
        </Button>
      ) : inspect.off || answer === null ? (
        inspectButton
      ) : (
        // display: contents keeps the button in the row's layout; the form carries the answer to SCR-VER-03.
        <form action={inspectThisPremises.bind(null, answer)} style={{ display: "contents" }}>
          {inspectButton}
        </form>
      )}
      <Button variant="secondary" size="md" icon="qr-code" fullWidth href={routes.fieldScan()} locale={locale}>
        {t("ver02.scanAnother")}
      </Button>
    </ButtonRow>
  );
}

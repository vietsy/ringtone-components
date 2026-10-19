import { Banner, Button, ButtonRow, ChoiceList, FactList, PageHeader, Panel, Skeleton, TextField, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { requestReconsiderationAct } from "@/features/inspection/record-actions";
import { refusalNaming } from "@/features/inspection/standing";
import { findingsText, refusalOf, refusalSentence, stateWords } from "@/features/inspection/words";
import { readForPage } from "@/lib/api/flash";
import { loadReconsideration, type AnswerOutcome, type Reconsideration, type ReconsiderationAttempt, type RefusalCode } from "@/lib/api/inspection";
import { requirePrincipal, type Principal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/** Refusals of the request said above the form with Retry, the grounds kept (design/03 SCR-VER-14, Refused). */
const RETRY: readonly RefusalCode[] = ["CASE_INTAKE_UNAVAILABLE", "CASE_STATE_UNAVAILABLE", "PREMISES_READ_UNAVAILABLE"];

/**
 * SCR-VER-14 Request reconsideration of a record or an answer. The screen shows what the subject showed and
 * when, asks for the grounds (and the premises, where an answer names none), and sends the request, which opens
 * a case carrying both. Opened from a record on SCR-VER-13, or with a reference the person was given.
 */
export default async function ReconsiderationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Signed in as the premises principal, or sent to sign in.
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  const loading = reviewView(params, ["loading"] as const) === "loading";
  const attempt = readForPage<ReconsiderationAttempt>(params);
  const outcome = loading ? null : await loadReconsideration(principal, text(params.subject), text(params.sent), locale);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const subjectPremises =
    data?.subject?.kind === "INSPECTION_RECORD" ? data.subject.record.premises.name : data?.subject?.kind === "ANSWER" ? (data.subject.premises?.name ?? null) : null;

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("inspections", frame, locale)}
      account={principal.account}
      context={subjectPremises !== null ? { premises: subjectPremises, label: t("ver13.premisesLabel") } : { premises: principal.party, label: t("ver13.partyLabel") }}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0, maxWidth: "var(--container-3xl)" }}>
        <PageHeader crumbs={[{ label: t("console.crumb"), href: routes.inspectionRecords() }]} title={t("ver14.title")} locale={locale} />
        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("ver.errTitle")}
            errorText={t("ver.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="portal"
            level={2}
            locale={locale}
          />
        ) : attempt?.refusal === "NOT_PARTY_TO_SUBJECT" ? (
          <ViewState view="refused" refusal={{ ...refusalOf(t, "NOT_PARTY_TO_SUBJECT"), family: "attention" }} density="portal" level={2} locale={locale} />
        ) : (
          <Request data={data} attempt={attempt} principal={principal} phone={phone} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

function Request({
  data,
  attempt,
  principal,
  phone,
  t,
  locale,
}: {
  data: Reconsideration | null;
  attempt: ReconsiderationAttempt | null;
  principal: Principal;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const inset = phone ? "sm" : "md";
  if (data !== null && data.sent !== null) {
    return (
      <Banner
        family="positive"
        title={t("ver14.sentTitle", { c: data.sent.case })}
        action={{ label: t("ver14.openCase"), href: routes.myCase(data.sent.case), variant: "secondary" }}
        density="portal"
        locale={locale}
      >
        {t("ver14.sentText")}
      </Banner>
    );
  }
  const refusal = attempt?.refusal ?? null;
  const subject = data?.subject ?? null;
  // A refusal of the subject itself stands in place of what was shown, and no form is offered for it.
  const subjectRefusal = refusal === "SUBJECT_NOT_FOUND" ? refusal : (data?.subjectRefusal ?? null);
  const header = refusal !== null && (RETRY.includes(refusal) || refusal === "SUBJECT_SUPERSEDED" || refusal === "CHALLENGE_ALREADY_OPEN") ? refusal : null;
  const named = header !== null ? refusalNaming(t, header, attempt?.detail ?? null, locale) : null;
  const byReference = data !== null && (subject === null || data.typed === "" || subject.kind === "ANSWER");
  const askPremises = subject?.kind === "ANSWER" && subject.premises === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
      {named !== null && header !== null && (
        <Banner
          family={header === "CHALLENGE_ALREADY_OPEN" ? "neutral" : "attention"}
          title={named.title}
          code={header}
          {...(RETRY.includes(header) ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.requestReconsideration({ subject: attempt?.subject }) } } : {})}
          {...(header === "SUBJECT_SUPERSEDED" && attempt !== null ? { actions: { label: t("ver14.versionInForce"), variant: "secondary", href: routes.inspectionRecord(attempt.subject) } } : {})}
          density="portal"
          locale={locale}
        >
          {named.text}
        </Banner>
      )}
      <Panel title={t("ver14.shown")} level={2} inset={inset} gap="lg" density="portal" locale={locale}>
        {byReference && (
          // Looking a reference up is a read: a GET form, so the reference is the page's address.
          <form action={routes.requestReconsideration()} method="get" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <TextField label={t("ver14.reference")} name="subject" mono value={data?.typed ?? ""} required density="portal" locale={locale} />
            <div>
              <Button type="submit" variant="secondary" size="md" icon="search" fullWidth={phone} locale={locale}>
                {t("ver14.open")}
              </Button>
            </div>
          </form>
        )}
        {data === null && <Skeleton variant="facts" rows={4} density="portal" locale={locale} />}
        {subjectRefusal !== null && (
          <Banner family="attention" title={refusalOf(t, subjectRefusal).title} code={subjectRefusal} density="portal" locale={locale}>
            {refusalOf(t, subjectRefusal).text}
          </Banner>
        )}
        {subject !== null && subjectRefusal === null && <FactList items={shownFacts(subject, t, locale)} density="portal" locale={locale} />}
      </Panel>
      {subject !== null && subjectRefusal === null && (
        <Panel inset={inset} gap="xl" density="portal" locale={locale}>
          <form action={requestReconsiderationAct} style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            <input type="hidden" name="subject" value={subject.kind === "INSPECTION_RECORD" ? subject.record.reference : subject.reference} />
            {subject.kind === "INSPECTION_RECORD" && <input type="hidden" name="version" value={String(subject.record.version)} />}
            {askPremises && (
              <ChoiceList
                legend={t("ver14.premises")}
                helper={t("ver14.noPremises")}
                name="premises_id"
                options={(data?.premisesOptions ?? []).map((option) => ({ value: option.id, label: option.name }))}
                {...(attempt !== null && attempt.premises !== null ? { value: attempt.premises } : {})}
                {...(refusal === "PREMISES_REQUIRED" ? { error: refusalSentence(t, refusal) } : {})}
                required
                density="portal"
                locale={locale}
              />
            )}
            <TextField
              label={t("ver14.grounds")}
              name="grounds"
              value={attempt?.grounds ?? ""}
              helper={t("ver14.groundsHelp")}
              {...(refusal === "GROUNDS_MISSING" ? { error: refusalSentence(t, refusal) } : {})}
              multiline
              rows={6}
              required
              maxLength={4000}
              density="portal"
              locale={locale}
            />
            <FactList items={[{ label: t("ver14.sentBy"), value: t("ver14.principal", { name: principal.account }) }]} density="portal" locale={locale} />
            <Text size="base" tone="secondary">
              {t("ver14.after")}
            </Text>
            <ButtonRow>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon="arrow-right"
                fullWidth={phone}
                {...(header === "CHALLENGE_ALREADY_OPEN" && named !== null ? { disabled: true, disabledReason: named.title } : {})}
                locale={locale}
              >
                {t("ver14.send")}
              </Button>
              <Button
                variant="quiet"
                size="md"
                fullWidth={phone}
                href={subject.kind === "INSPECTION_RECORD" ? routes.inspectionRecord(subject.record.reference) : routes.inspectionRecords()}
                locale={locale}
              >
                {t("ver.cancel")}
              </Button>
            </ButtonRow>
          </form>
        </Panel>
      )}
    </div>
  );
}

/** What the subject showed, in words, with the instant it showed it (design/03 SCR-VER-14, What was shown). */
function shownFacts(subject: NonNullable<Reconsideration["subject"]>, t: Translate, locale: Locale) {
  if (subject.kind === "INSPECTION_RECORD") {
    const { record } = subject;
    return [
      { label: t("ver14.lRecord"), value: t("ver13.recordVersion", { r: record.reference, n: record.version }) },
      { label: t("ver13.lOutcome"), value: t(`ver.outcome.${record.outcome}`) },
      { label: t("ver13.lRecorded"), value: findingsText(t, record.findings, "sentences"), missing: t("ver06.none") },
      { label: t("ver13.lGuidance"), value: record.guidance, missing: t("ver06.none") },
      { label: t("ver14.shownAt"), value: record.issuedAt, kind: "datetime" as const },
    ];
  }
  return [
    { label: t("ver14.lAnswer"), value: subject.reference, kind: "id" as const },
    ...(subject.premises !== null ? [{ label: t("ver14.lPremises"), value: subject.premises.name }] : []),
    { label: t("ver14.lState"), value: answerState(subject.outcome, t, locale) },
    ...(subject.scope !== null ? [{ label: t("ver14.lScope"), value: subject.scope }] : []),
    { label: t("ver14.shownAt"), value: subject.shownAt, kind: "datetime" as const },
  ];
}

/** An answer's state in the words it was shown with: the record's state, or that no record has the reference. */
function answerState(outcome: AnswerOutcome, t: Translate, locale: Locale): string | null {
  if (outcome.kind === "CURRENT_RESULT") return stateWords(t, outcome.state, outcome.period.from, locale);
  if (outcome.kind === "NO_RECORD" || outcome.kind === "NO_PREMISES_IN_JURISDICTION" || outcome.kind === "NO_CURRENT_RECORD_FOR_PREMISES") return t("ver14.noRecordAnswer");
  return null;
}

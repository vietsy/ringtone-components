import { redirect } from "next/navigation";
import { Banner, Button, ButtonRow, Checkbox, DateField, Divider, EmptyState, FactList, Panel, Select, Skeleton, TextField } from "@/components/r1";
import { Text } from "@/components/Text";
import { DraftFrame, DraftUnavailable, StepError } from "@/features/registration/DraftFrame";
import { GatedForm, GatedSubmit, IntentSubmit } from "@/features/registration/GatedForm";
import { saveFacts } from "@/features/registration/actions";
import { count, daysOpen, regTranslator } from "@/features/registration/copy";
import { readDate } from "@/features/registration/fields";
import { readForPage } from "@/lib/api/flash";
import {
  loadApplicationDraft,
  loadFactsStep,
  type FactAnswers,
  type FactQuestion,
  type FactsAttempt,
  type FactsStep,
  type MusicMethod,
  type PremisesClass,
} from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG03_VIEWS } from "@/lib/mock/registration";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;
/** Each answer as the form shows it: the saved value written out, or what was typed in a refused save. */
type Shown = Record<FactQuestion, string>;

const CLASSES: readonly PremisesClass[] = ["cafe", "restaurant", "bar", "karaoke", "hotel", "shop"];
const METHODS: readonly MusicMethod[] = ["speakers", "live", "both", "screens"];
const DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Reads RightOne could not make: the questions give way to the banner, and Next waits for a second read. */
const UNAVAILABLE: Readonly<Record<string, { title: string; text: string; off: string }>> = {
  POLICY_READ_UNAVAILABLE: { title: "reg03.unavTitle", text: "reg03.unavText", off: "reg03.offUnav" },
  PREMISES_READ_UNAVAILABLE: { title: "reg.refusal.PREMISES_READ_UNAVAILABLE.title", text: "reg.refusal.PREMISES_READ_UNAVAILABLE.text", off: "reg03.offPru" },
};

/** Rules that stop the questions; the draft is kept and RightOne resolves them. */
const BLOCKED: Readonly<Record<NonNullable<FactsStep["blocked"]>, { family: "neutral" | "attention"; off: string }>> = {
  RULEBOOK_NOT_APPROVED: { family: "neutral", off: "reg03.offRna" },
  RULEBOOK_EXCEEDS_FACT_LIMIT: { family: "attention", off: "reg03.offLim" },
  USE_START_REQUIRED: { family: "attention", off: "reg03.offUsr" },
};

const FIELD_ERRORS: Readonly<Record<string, string>> = {
  FACT_VALUE_INVALID: "reg03.invalid",
  FACT_DERIVED_NOT_DECLARABLE: "reg03.derived",
};

/**
 * SCR-REG-03 Tell us about the premises. What the register already holds is shown, not asked; the person
 * answers at most five questions, and the answers save when they move on to the documents or leave.
 */
export default async function FactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ application: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipal();
  const [{ application }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = regTranslator(locale);
  const view = reviewView(query, REG03_VIEWS);
  const draft = await loadApplicationDraft(principal.sessionId, application, "facts", view);
  // A sent application's steps are over: its status page says where it stands.
  if (draft.failure?.code === "APPLICATION_NOT_EDITABLE") redirect(routes.application(application));
  const outcome = draft.failure !== null || view === "loading" ? null : await loadFactsStep(principal.sessionId, application, view);
  const last = readForPage<FactsAttempt>(query);
  const attempt = last?.page === "facts" && last.application === application ? last : null;
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const unavailable = failure !== null ? UNAVAILABLE[failure.code] : undefined;
  const phone = frame === "phone";
  const reference = draft.data?.reference ?? application;

  return (
    <DraftFrame
      step="facts"
      reference={application}
      draft={draft.data}
      title={t("reg03.title")}
      savedAt={draft.data !== null && (failure === null || unavailable !== undefined) ? draft.data.savedAt : null}
      frame={frame}
      t={t}
      locale={locale}
    >
      {draft.failure !== null ? <DraftUnavailable failure={draft.failure} phone={phone} t={t} locale={locale} /> : null}

      {failure !== null && unavailable !== undefined ? (
        <>
          <Banner
            family="attention"
            title={t(unavailable.title)}
            code={failure.code}
            action={{ label: t("reg03.reread"), variant: "primary", icon: "refresh-cw", href: routes.applicationFacts(reference) }}
            density="portal"
            locale={locale}
          >
            {t(unavailable.text)}
          </Banner>
          <ButtonRow>
            <Button variant="secondary" size="md" disabled disabledReason={t(unavailable.off)} fullWidth={phone} locale={locale}>
              {t("reg03.next")}
            </Button>
            <Button variant="quiet" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
              {t("reg03.leave")}
            </Button>
          </ButtonRow>
        </>
      ) : null}

      {failure !== null && unavailable === undefined ? <StepError failure={failure} t={t} locale={locale} /> : null}

      {draft.failure === null && view === "loading" ? (
        <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={3} density="portal" locale={locale} />
          <Divider />
          <Skeleton variant="card" rows={4} density="portal" locale={locale} />
        </Panel>
      ) : null}

      {step !== null ? <FactsForm step={step} attempt={attempt} reference={reference} phone={phone} t={t} locale={locale} /> : null}
    </DraftFrame>
  );
}

/** The saved answers as the fields show them. */
function shownAnswers(answers: FactAnswers, locale: Locale): Shown {
  return {
    premises_class: answers.premisesClass ?? "",
    customer_area: answers.customerArea !== null ? count(answers.customerArea, locale) : "",
    days_open: answers.daysOpen !== null ? String(answers.daysOpen) : "",
    music_method: answers.musicMethod ?? "",
    use_began_on: answers.useBeganOn ?? "",
  };
}

function FactsForm({
  step,
  attempt,
  reference,
  phone,
  t,
  locale,
}: {
  step: FactsStep;
  /** The save that was refused: every answer as typed, and the refusal under each answer it names. */
  attempt: FactsAttempt | null;
  reference: string;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { known, copied, blocked } = step;
  const shown: Shown = { ...shownAnswers(step.answers, locale), ...(attempt?.values ?? {}) };
  const fieldErrors = attempt?.fieldErrors ?? step.fieldErrors;
  const classAsked = step.questions.includes("premises_class");
  const asksQuestions = step.questions.length > 0 && blocked === null;
  const allKnown = step.questions.length === 0 && blocked === null;
  const copiedInfo = copied !== null ? { info: t("reg03.copied") } : {};
  // Next waits for every question; the first one unanswered says why, in the board's words.
  const answerAll = t(classAsked ? "reg03.offClass" : "reg03.offFour");
  const reasons = [
    ...(classAsked ? [{ field: "premises_class", text: answerAll }] : []),
    { field: "customer_area", text: answerAll },
    { field: "days_open", text: answerAll },
    { field: "music_method", text: answerAll },
    { field: "use_began_on", text: t("reg03.offBegan") },
  ];
  const required = asksQuestions ? step.questions : [];
  const errorOf = (question: FactQuestion) => {
    const code = fieldErrors[question];
    return code !== undefined ? { error: t(FIELD_ERRORS[code] ?? "reg.errText") } : {};
  };
  // A renewal asks whether each copied answer is still true, under the answer.
  const stillTrue = (question: FactQuestion) => {
    const confirmed = copied?.[question];
    if (confirmed === undefined) return null;
    const checked = attempt !== null ? attempt.reconfirmed.includes(question) : confirmed;
    return <Checkbox label={t("reg03.still")} checked={checked} name={`reconfirm_${question}`} density="portal" locale={locale} />;
  };
  // A date typed in a refused save is shown again when it can be read; otherwise the field starts empty.
  const began = shown.use_began_on !== "" ? readDate(shown.use_began_on) : null;

  return (
    <>
      {/* A save that was refused leaves every answer as entered, so the form stays under the banner. */}
      {step.saveRefusal !== null ? (
        <div aria-live="polite" style={{ minWidth: 0 }}>
          <Banner
            family="attention"
            title={t(`reg.refusal.${step.saveRefusal}.title`)}
            code={step.saveRefusal}
            {...(step.saveRefusal === "DATA_GOVERNANCE_UNAVAILABLE"
              ? { action: { label: t("reg03.reread"), variant: "secondary" as const, icon: "refresh-cw", href: routes.applicationFacts(reference) } }
              : {})}
            density="portal"
            locale={locale}
          >
            {t(`reg.refusal.${step.saveRefusal}.text`)}
          </Banner>
        </div>
      ) : null}
      <GatedForm
        action={saveFacts.bind(null, reference)}
        required={required}
        initiallyMissing={required.filter((question) => shown[question].trim() === "")}
      >
        <input type="hidden" name="intent" value="next" />
        <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          {allKnown ? (
            <>
              <EmptyState variant="governed" title={t("reg03.emptyTitle")} density="portal" locale={locale}>
                {t("reg03.emptyText")}
              </EmptyState>
              <Divider />
            </>
          ) : null}
          <Panel variant="plain" level={2} title={t("reg03.knownTitle")} description={t("reg03.knownDesc")} density="portal" locale={locale}>
            {/* A fact the register did not answer is not shown empty: the class becomes a question, the area is left out. */}
            <FactList
              items={[
                { label: t("reg03.fBrn"), value: known.businessRegistration, kind: "mono", provenance: "registry-sourced" },
                ...(known.administrativeArea !== null ? [{ label: t("reg03.fArea"), value: known.administrativeArea, provenance: "registry-sourced" as const }] : []),
                ...(known.premisesClass !== null
                  ? [
                      {
                        label: t("reg.question.premises_class"),
                        value: t(`reg.class.${known.premisesClass}`),
                        provenance: "registry-sourced" as const,
                        ...(known.classChanged ? { note: t("reg03.changed") } : {}),
                      },
                    ]
                  : []),
              ]}
              provenanceWords="plain"
              density="portal"
              locale={locale}
            />
            <Text size="sm" tone="secondary">
              {t("reg03.wrongLine")}
            </Text>
          </Panel>
          <Divider />
          {blocked !== null ? (
            <>
              <Banner family={BLOCKED[blocked].family} title={t(`reg.refusal.${blocked}.title`)} code={blocked} density="portal" locale={locale}>
                {t(`reg.refusal.${blocked}.text`)}
              </Banner>
              <Divider />
            </>
          ) : null}
          {asksQuestions ? (
            <>
              <Panel variant="plain" level={2} title={t(classAsked ? "reg03.q5" : "reg03.q4")} density="portal" locale={locale}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                  {classAsked ? (
                    <Select
                      label={t("reg.question.premises_class")}
                      helper={t("reg03.qClassHelp")}
                      options={CLASSES.map((value) => ({ value, label: t(`reg.class.${value}`) }))}
                      value={shown.premises_class}
                      placeholder={t("reg03.classPh")}
                      {...errorOf("premises_class")}
                      required
                      width="var(--container-xs)"
                      name="premises_class"
                      density="portal"
                      locale={locale}
                    />
                  ) : null}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <TextField
                      label={t("reg.question.customer_area")}
                      helper={t("reg03.qAreaHelp")}
                      value={shown.customer_area}
                      suffix={t("reg.squareMetres")}
                      inputMode="numeric"
                      {...errorOf("customer_area")}
                      {...copiedInfo}
                      required
                      width="var(--space-48)"
                      name="customer_area"
                      density="portal"
                      locale={locale}
                    />
                    {stillTrue("customer_area")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <Select
                      label={t("reg.question.days_open")}
                      options={DAYS.map((days) => ({ value: String(days), label: daysOpen(days, t, locale) }))}
                      value={shown.days_open}
                      // Unanswered, the select says so rather than showing its first option as if it were an answer.
                      {...(shown.days_open === "" ? { placeholder: t("reg03.daysPh") } : {})}
                      {...errorOf("days_open")}
                      {...copiedInfo}
                      required
                      width="var(--space-48)"
                      name="days_open"
                      density="portal"
                      locale={locale}
                    />
                    {stillTrue("days_open")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <Select
                      label={t("reg.question.music_method")}
                      options={METHODS.map((value) => ({ value, label: t(`reg.music.${value}`) }))}
                      value={shown.music_method}
                      {...(shown.music_method === "" ? { placeholder: t("reg03.methodPh") } : {})}
                      {...errorOf("music_method")}
                      {...copiedInfo}
                      required
                      width="var(--container-xs)"
                      name="music_method"
                      density="portal"
                      locale={locale}
                    />
                    {stillTrue("music_method")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <DateField
                      label={t("reg.question.use_began_on")}
                      helper={t("reg03.qBeganHelp")}
                      {...(began !== null ? { value: began } : {})}
                      max={step.today}
                      today={step.today}
                      {...errorOf("use_began_on")}
                      {...copiedInfo}
                      required
                      width="var(--space-48)"
                      name="use_began_on"
                      density="portal"
                      locale={locale}
                    />
                    {stillTrue("use_began_on")}
                  </div>
                </div>
                <Text size="sm" tone="secondary">
                  {t("reg03.savingLine")}
                </Text>
              </Panel>
              <Divider />
            </>
          ) : null}
          <ButtonRow>
            <GatedSubmit
              reasons={reasons}
              blocked={blocked !== null ? t(BLOCKED[blocked].off) : null}
              variant="primary"
              size="md"
              fullWidth={phone}
              locale={locale}
            >
              {t("reg03.next")}
            </GatedSubmit>
            <IntentSubmit intent="leave" variant="quiet" size="md" fullWidth={phone} locale={locale}>
              {t("reg03.leave")}
            </IntentSubmit>
          </ButtonRow>
        </Panel>
      </GatedForm>
    </>
  );
}

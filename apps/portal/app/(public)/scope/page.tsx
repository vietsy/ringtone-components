import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  Button,
  ChoiceList,
  DateField,
  EmptyState,
  FactList,
  Link,
  NavList,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusLine,
  TextField,
} from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { assessScope } from "@/features/public/actions";
import { assumedLine, basisLine, exemptionLines } from "@/features/public/guidance";
import { publicLayout } from "@/features/public/layout";
import { nextActionFact } from "@/features/public/next-action";
import { PageError } from "@/features/public/PageError";
import { SupportPanel } from "@/features/public/SupportPanel";
import { readForPage } from "@/lib/api/flash";
import { loadHelpRoutes, loadScopeAssessment, type Attempt, type DeclaredPremises, type FactField, type ScopeAnswer, type ScopeAssessmentPage } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { PUB02_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * SCR-PUB-02 Scope self-assessment. A member of the public answers the questions the scope rules use
 * about a premises and reads whether the service is likely to apply, why, and what to do next: guidance,
 * never a decision.
 */
export default async function ScopePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the questions of today's tariff and the reader's own last answer.
  const view = reviewView(params, PUB02_VIEWS);
  const last = view === null ? readForPage<Attempt<ScopeAnswer>>(params) : null;
  const { narrow, gap, inset } = publicLayout(frame);
  // "checking" is the form while its answer is being worked out: the form as drawn, the button busy.
  const outcome = view === "loading" ? null : await loadScopeAssessment(view === "checking" ? "form" : view, last);
  const failure = outcome?.failure ?? null;
  const data = outcome?.data ?? null;
  const refusal = data?.assessment?.failure ?? null;
  const answer = data?.assessment?.data ?? null;
  // The guidance could not reach the tariff, on opening or for the date asked (DR-491 row 1): the support line instead.
  const guidanceOff = failure?.code === "GUIDANCE_UNAVAILABLE" || answer?.cause === "GUIDANCE_UNAVAILABLE";
  // An answer whose next action is the support route: no scope guide is in effect to say what to do (DR-491).
  const toSupport = !guidanceOff && answer?.nextAction === "support";
  const helpRoutes = guidanceOff || toSupport ? await loadHelpRoutes() : null;
  const inputInvalid = refusal?.code === "ASSESSMENT_INPUT_INVALID";

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader title={t("pub02.title")} size="public" locale={locale} />

        {view === "loading" && (
          <Panel title={t("pub.formTitle")} level={2} inset={inset} density="portal" locale={locale}>
            <Skeleton variant="facts" rows={4} density="portal" locale={locale} />
          </Panel>
        )}

        {guidanceOff && (
          <>
            <Banner family="info" title={t("pub.guidanceTitle")} code="GUIDANCE_UNAVAILABLE" density="portal" locale={locale}>
              {t("pub.guidanceText")}
            </Banner>
            {helpRoutes !== null && <SupportPanel helpRoutes={helpRoutes} withConfirmed inset={inset} t={t} locale={locale} />}
          </>
        )}
        {failure !== null && !guidanceOff && <PageError failure={failure} t={t} locale={locale} />}

        {inputInvalid && (
          <Banner family="attention" title={t("pub.badTitle")} code={refusal.code} density="portal" locale={locale}>
            {t("pub.badText")}
          </Banner>
        )}

        {data !== null && !guidanceOff && (
          <Form
            data={data}
            // No approved tariff for the date asked: no question, and the cause in words (DR-491 row 2).
            noRules={answer?.cause === "NO_RULES_FOR_DATE"}
            invalid={inputInvalid ? data.invalid : []}
            checking={view === "checking"}
            narrow={narrow}
            inset={inset}
            t={t}
            locale={locale}
          />
        )}

        {answer !== null && answer.cause === null && data !== null && (
          <Answer answer={answer} declared={data.declared} inset={inset} t={t} locale={locale} />
        )}
        {toSupport && helpRoutes !== null && <SupportPanel helpRoutes={helpRoutes} withConfirmed inset={inset} t={t} locale={locale} />}
        {refusal !== null && !inputInvalid && <PageError failure={refusal} t={t} locale={locale} />}

        <NavList
          title={t("pub.goTitle")}
          items={[
            { label: t("pub.about"), detail: t("pub02.aboutD"), icon: "info", href: routes.home() },
            { label: t("pub02.tariff"), detail: t("pub02.tariffD"), icon: "banknote", href: routes.disclosures() },
            { label: t("pub.help"), detail: t("pub.helpD"), icon: "circle-help", href: routes.help() },
          ]}
          locale={locale}
        />
      </div>
    </PublicShell>
  );
}

function Form({
  data,
  noRules,
  invalid,
  checking,
  narrow,
  inset,
  t,
  locale,
}: {
  data: ScopeAssessmentPage;
  noRules: boolean;
  invalid: readonly FactField[];
  checking: boolean;
  narrow: boolean;
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
}) {
  const asked = noRules ? null : data.questions.questions;
  const declared = data.declared;
  const marked = (name: FactField, message: string) => (invalid.includes(name) ? { error: t(message) } : {});
  // The floor area and the seats are asked where the version uses them, the floor area required by its size bands.
  const floor = asked?.facts.find((fact) => fact.key === "FLOOR_AREA_M2") ?? null;
  const seats = asked?.facts.find((fact) => fact.key === "SEATING_CAPACITY") ?? null;
  return (
    <form action={assessScope}>
      <Panel as="fieldset" title={t("pub.formTitle")} description={t("pub.formLead")} level={2} gap="lg" inset={inset} density="portal" locale={locale}>
        <DateField
          label={t("pub.date")}
          name="assessment_date"
          {...(ISO_DATE.test(declared.assessmentDate) ? { value: declared.assessmentDate } : {})}
          {...marked("assessment_date", "pub.dateError")}
          helper={t("pub.dateHelp")}
          density="portal"
          locale={locale}
        />
        {asked !== null ? (
          <>
            <ChoiceList
              legend={t("pub.classQ")}
              helper={t("pub02.classHelp")}
              options={asked.premisesClasses.map((value) => ({ value, label: t(`pub.class.${value}`) }))}
              {...(declared.premisesClass !== null ? { value: declared.premisesClass } : {})}
              {...marked("premises_class", "pub.classError")}
              name="premises_class"
              density="portal"
              locale={locale}
            />
            <Select
              label={t("pub.areaQ")}
              name="admin_area_key"
              options={asked.adminAreas.map((value) => ({ value, label: t(`pub.area.${value}`) }))}
              {...(declared.adminArea !== null ? { value: declared.adminArea } : { placeholder: t("pub.areaPlaceholder") })}
              {...marked("admin_area_key", "pub.areaError")}
              density="portal"
              locale={locale}
            />
            {floor !== null && (
              <TextField
                label={t("pub.floorQ")}
                name="floor_area_m2"
                value={declared.floorAreaM2}
                {...marked("floor_area_m2", "pub.floorError")}
                suffix={t("pub.unitM2")}
                inputMode="decimal"
                required={floor.required}
                width="var(--space-48)"
                density="portal"
                locale={locale}
              />
            )}
            {seats !== null && (
              <TextField
                label={t("pub.seatsQ")}
                name="seating_capacity"
                helper={t("pub.seatsHelp")}
                value={declared.seats}
                {...marked("seating_capacity", "pub.seatsError")}
                inputMode="numeric"
                required={seats.required}
                width="var(--space-48)"
                density="portal"
                locale={locale}
              />
            )}
            <Button variant="primary" size="md" type="submit" fullWidth={narrow} loading={checking} loadingLabel={t("pub02.checking")} locale={locale}>
              {t("pub02.see")}
            </Button>
          </>
        ) : (
          <EmptyState variant="governed" title={t("pub02.noRules")} level={3} density="portal" action={false} locale={locale} />
        )}
      </Panel>
    </form>
  );
}

const STATUS = {
  in_scope: { family: "info", text: "pub02.inScope" },
  out_of_scope: { family: "neutral", text: "pub02.outOfScope" },
  indeterminate: { family: "neutral", text: "pub02.indeterminate" },
} as const;

function Answer({
  answer,
  declared,
  inset,
  t,
  locale,
}: {
  answer: ScopeAnswer;
  declared: DeclaredPremises;
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
}) {
  const status = STATUS[answer.outcome];
  return (
    <Panel title={t("pub02.resultTitle")} level={2} gap="md" inset={inset} density="portal" locale={locale}>
      <StatusLine family={status.family} text={t(status.text)} locale={locale} />
      <FactList
        items={[
          ...(answer.basis !== null ? [{ label: t("pub02.fBasis"), value: basisLine(answer.basis, answer.tariffVersion, t, locale) }] : []),
          ...(answer.assumed !== null ? [{ label: t("pub.fAssumed"), value: assumedLine(answer.assumed, t, locale) }] : []),
          ...(answer.exemptions.length > 0 ? [{ label: t("pub.fExempt"), value: exemptionLines(answer.exemptions, t, locale) }] : []),
          ...(answer.tariffVersion !== null
            ? [{ label: t("pub.fVersion"), value: t("pub02.version", { version: answer.tariffVersion, date: R1_FORMAT.formatDate(answer.assessmentDate, locale) ?? "-" }) }]
            : []),
          { label: t("pub.fNext"), ...nextActionFact(answer.nextAction, answer.nextActionText, t, locale) },
        ]}
        locale={locale}
      />
      <Text size="sm" tone="secondary">{t("pub02.notDecision")}</Text>
      {answer.outcome === "in_scope" && (
        // Not on the board: the indicative amount (SCR-PUB-03) is otherwise reached only from the tariff page,
        // which is not built; the facts just answered go with the reader. Awaiting the BA (see README).
        <div>
          <Link
            href={routes.indicativeAmount({
              assessment_date: declared.assessmentDate,
              premises_class: declared.premisesClass ?? "",
              admin_area_key: declared.adminArea ?? "",
              floor_area_m2: declared.floorAreaM2,
              seating_capacity: declared.seats,
            })}
            variant="standalone"
            locale={locale}
          >
            {t("pub02.toAmount")}
          </Link>
        </div>
      )}
    </Panel>
  );
}

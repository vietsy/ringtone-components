import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  Breakdown,
  Button,
  ChoiceList,
  DateField,
  FactList,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusLine,
  TextField,
  ViewState,
} from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { calculateIndicativeAmount } from "@/features/public/actions";
import { assumedLine, componentBasis, exemptionLines } from "@/features/public/guidance";
import { publicLayout } from "@/features/public/layout";
import { nextActionFact } from "@/features/public/next-action";
import { PageError } from "@/features/public/PageError";
import { SupportPanel } from "@/features/public/SupportPanel";
import { readForPage } from "@/lib/api/flash";
import {
  loadHelpRoutes,
  loadIndicativeAmount,
  type Attempt,
  type FactField,
  type IndicatedAmount,
  type IndicativeAmountPage,
  type IndicativeResult,
} from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { PUB03_VIEWS } from "@/lib/mock/public";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Refusals of the calculation, drawn above the form they refused. */
const INLINE_REFUSALS: Readonly<Record<string, { family: "attention" | "danger"; title: string; text: string | null }>> = {
  ASSESSMENT_INPUT_INVALID: { family: "attention", title: "pub.badTitle", text: "pub.badText" },
  NO_TARIFF_FOR_DATE: { family: "attention", title: "pub03.noTariffTitle", text: null },
  TARIFF_UNAVAILABLE: { family: "danger", title: "pub03.unavailTitle", text: "pub03.unavailText" },
};

/**
 * SCR-PUB-03 Indicative amount. Where offered, a member of the public sees an indicative amount for a
 * premises, labelled as guidance that is not an obligation, an invoice or an amount to pay, with the
 * assumptions it was worked out from.
 */
export default async function IndicativeAmountRoute({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise today's questions and the reader's own last calculation.
  const view = reviewView(params, PUB03_VIEWS);
  const last = view === null ? readForPage<Attempt<IndicativeResult>>(params) : null;
  const { narrow, gap, inset } = publicLayout(frame);
  const outcome = view === "loading" ? null : await loadIndicativeAmount(view, last, params);
  const failure = outcome?.failure ?? null;
  const data = outcome?.data ?? null;
  const helpRoutes = failure?.code === "GUIDANCE_UNAVAILABLE" ? await loadHelpRoutes() : null;
  const result = data?.calculation?.data ?? null;
  const refused = data?.calculation?.failure ?? null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader title={t("pub03.title")} size="public" locale={locale} />

        {view === "loading" && (
          <Panel title={t("pub.formTitle")} level={2} inset={inset} density="portal" locale={locale}>
            <Skeleton variant="facts" rows={4} density="portal" locale={locale} />
          </Panel>
        )}

        {failure?.code === "INDICATIVE_NOT_OFFERED" && (
          <ViewState
            view="refused"
            refusal={{ code: failure.code, title: t("pub03.noTitle"), text: t("pub03.noText"), family: "info" }}
            level={2}
            density="portal"
            locale={locale}
          />
        )}
        {failure?.code === "GUIDANCE_UNAVAILABLE" && (
          <>
            <Banner family="info" title={t("pub.guidanceTitle")} code={failure.code} density="portal" locale={locale}>
              {t("pub.guidanceText")}
            </Banner>
            {helpRoutes !== null && <SupportPanel helpRoutes={helpRoutes} withConfirmed={false} inset={inset} t={t} locale={locale} />}
          </>
        )}
        {failure !== null && failure.code !== "INDICATIVE_NOT_OFFERED" && failure.code !== "GUIDANCE_UNAVAILABLE" && (
          <PageError failure={failure} t={t} locale={locale} />
        )}

        {data !== null && result === null && (
          <>
            {refused !== null && <CalculationRefusal failure={refused} t={t} locale={locale} />}
            <Form data={data} invalid={refused?.code === "ASSESSMENT_INPUT_INVALID" ? data.invalid : []} narrow={narrow} inset={inset} t={t} locale={locale} />
          </>
        )}

        {result?.outcome === "indicated" && <Indicated result={result} inset={inset} t={t} locale={locale} />}

        {result?.outcome === "no_amount" && (
          <Panel title={t("pub03.amountTitle")} level={2} gap="md" inset={inset} density="portal" locale={locale}>
            <StatusLine family="neutral" text={t("pub03.noAmount")} locale={locale} />
            <FactList
              items={[
                { label: t("pub03.fOutcome"), value: t(result.treatment === "out_of_scope" ? "pub02.outOfScope" : "pub03.outcome") },
                { label: t("pub.fNext"), ...nextActionFact(result.nextAction, t) },
              ]}
              locale={locale}
            />
          </Panel>
        )}
      </div>
    </PublicShell>
  );
}

function CalculationRefusal({ failure, t, locale }: { failure: { code: string; traceId: string | null; retryable: boolean }; t: Translate; locale: Locale }) {
  const refusal = INLINE_REFUSALS[failure.code];
  if (refusal === undefined) return <PageError failure={failure} t={t} locale={locale} />;
  return (
    <Banner family={refusal.family} title={t(refusal.title)} code={failure.code} density="portal" locale={locale}>
      {refusal.text !== null ? t(refusal.text) : null}
    </Banner>
  );
}

function Form({
  data,
  invalid,
  narrow,
  inset,
  t,
  locale,
}: {
  data: IndicativeAmountPage;
  invalid: readonly FactField[];
  narrow: boolean;
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
}) {
  const asked = data.questions.questions;
  const declared = data.declared;
  const marked = (name: FactField, message: string) => (invalid.includes(name) ? { error: t(message) } : {});
  return (
    <form action={calculateIndicativeAmount}>
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
        {asked !== null && (
          <>
            <ChoiceList
              legend={t("pub.classQ")}
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
          </>
        )}
        <TextField
          label={t("pub.floorQ")}
          name="floor_area_m2"
          value={declared.floorAreaM2}
          {...marked("floor_area_m2", "pub.floorError")}
          suffix={t("pub.unitM2")}
          inputMode="decimal"
          required
          width="var(--space-48)"
          density="portal"
          locale={locale}
        />
        <TextField
          label={t("pub.seatsQ")}
          name="seating_capacity"
          helper={t("pub.seatsHelp")}
          value={declared.seats}
          {...marked("seating_capacity", "pub.seatsError")}
          inputMode="numeric"
          width="var(--space-48)"
          density="portal"
          locale={locale}
        />
        <Button variant="primary" size="md" type="submit" fullWidth={narrow} locale={locale}>
          {t("pub03.calc")}
        </Button>
      </Panel>
    </form>
  );
}

const COMPONENT_ORDER = { works: 0, performers: 1, producers: 2 } as const;

function Indicated({ result, inset, t, locale }: { result: IndicatedAmount; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const money = (amountMinor: number) => R1_FORMAT.formatMoney(amountMinor, result.currency, locale) ?? "-";
  const source = t("pub03.source", { version: result.tariffVersion });
  const basis = componentBasis(result.basis, t, locale);
  // The canvas lists authors' rights first, then performers' and producers'.
  const components = [...result.components].sort((a, b) => COMPONENT_ORDER[a.right] - COMPONENT_ORDER[b.right]);
  return (
    <>
      <Breakdown
        title={t("pub03.amountTitle")}
        level={2}
        lines={[
          ...components.map((component) => ({ label: t(`pub03.component.${component.right}`), basis, source, amountMinor: component.amountMinor })),
          { label: t("pub03.subtotal"), amountMinor: result.amountBeforeCapMinor, kind: "subtotal" as const },
          { label: t("pub03.total"), amountMinor: result.amountMinor, kind: "total" as const },
        ]}
        currency={result.currency}
        indicative
        note={t("pub03.notBinding")}
        locale={locale}
      />
      <Panel title={t("pub03.howTitle")} level={2} inset={inset} density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("pub03.fPeriod"), value: result.period, kind: "period" },
            { label: t("pub.fVersion"), value: result.tariffVersion },
            { label: t("pub03.fTransition"), value: t("pub03.transition") },
            { label: t("pub.fAssumed"), value: assumedLine(result.assumed, t, locale) },
            { label: t("pub.fExempt"), value: exemptionLines(result.exemptions, t, locale) },
            {
              label: t("pub03.fCap"),
              value: result.capApplied
                ? t("pub03.capApplied", { cap: money(result.capMinor), amount: money(result.amountBeforeCapMinor) })
                : t("pub03.cap", { cap: money(result.capMinor) }),
            },
            { label: t("pub03.fRound"), value: t("pub03.round", { unit: money(result.roundingUnitMinor), amount: money(result.amountBeforeRoundingMinor) }) },
          ]}
          locale={locale}
        />
      </Panel>
    </>
  );
}

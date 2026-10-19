import { Banner, Button, ButtonRow, Divider, FactList, PageHeader, Panel, Skeleton, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { reproduceAct } from "@/features/tariff/actions";
import { basisFamily, COMPONENT_CODE, day, factorLine, factValue, hundredths, localityCode, moment, money, period, premisesClassCode, tarTranslator } from "@/features/tariff/console";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { loadCalculation, type Calculation, type CalculationPage, type ReproduceAttempt } from "@/lib/api/tariff";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { TAR_VIEWS } from "@/lib/mock/tariff";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The refusals that replace the page body: a calculation the reader may not see, or a reader who may not read. */
const PAGE_REFUSALS = ["CALCULATION_NOT_FOUND", "NOT_AUTHORISED"] as const;

/**
 * SCR-TAR-09 Calculation and its reproduction. No board draws it: it is built from TAR's specification and wireframe
 * on the console pattern of the finance detail pages. Every figure the calculation recorded, in the order the
 * calculator took them: the inputs, the classes with their basis, each component with its treatment, the exemption
 * condition by condition, the cap and the rounding; then its reproductions. The finance operator and the auditor
 * reproduce it and read MATCH or each difference.
 */
export default async function CalculationPage({ params, searchParams }: { params: Promise<{ calculation: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-FIN-OP", "ACT-AUD");
  const [{ calculation: reference }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = tarTranslator(locale);
  const view = reviewView(query, TAR_VIEWS);
  const kept = readForPage<ReproduceAttempt>(query);
  const attempt = kept !== null && kept.calculation === reference ? kept : null;
  const outcome = view === "loading" ? null : await loadCalculation(staff, reference, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const calc = data?.calculation ?? null;

  return (
    <OpsFrame console="operations" current="tariff" staff={staff} searchLabel={t("tar.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[
            { label: t("tar.tabs"), href: routes.opsTariff() },
            { label: t("tar.tab.calculations"), href: routes.opsTariff(calc !== null ? { premises: calc.premises.id } : undefined) },
            ...(calc !== null ? [{ label: calc.reference }] : []),
          ]}
          title={calc !== null ? t("tar09.title", { ref: calc.reference, premises: calc.premises.name }) : t("tar09.titlePlain")}
          {...(calc !== null
            ? {
                meta: t("tar09.meta", { purpose: calc.purpose, date: day(calc.decisionDate, locale), version: calc.version, ts: moment(calc.createdAt, locale) }),
              }
            : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Panel title={t("tar09.inputs")} level={2} density="console" locale={locale}>
            <Skeleton variant="facts" rows={8} density="console" locale={locale} />
          </Panel>
        ) : null}
        {failure !== null ? <Failure failure={failure} t={t} locale={locale} /> : null}
        {data !== null ? <Body data={data} attempt={attempt} reproduced={typeof query.reproduced === "string" ? query.reproduced : null} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Failure({ failure, t, locale }: { failure: { code: string; traceId: string | null; retryable: boolean }; t: Translate; locale: Locale }) {
  const refusal = PAGE_REFUSALS.find((code) => code === failure.code);
  if (refusal !== undefined) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
        <ViewState
          view="refused"
          refusal={{ code: refusal, title: t(`tar.refusal.${refusal}.title`), text: t(`tar.refusal.${refusal}.text`), family: "attention" }}
          level={2}
          density="console"
          locale={locale}
        />
        <Button variant="secondary" size="sm" href={routes.opsTariff()} locale={locale}>
          {t("tar09.back")}
        </Button>
      </div>
    );
  }
  return (
    <ViewState
      view="error"
      errorTitle={t("tar.errTitle")}
      errorText={t("tar.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      level={2}
      density="console"
      locale={locale}
    />
  );
}

function Body({
  data,
  attempt,
  reproduced,
  t,
  locale,
}: {
  data: CalculationPage;
  attempt: ReproduceAttempt | null;
  /** The reproduction just recorded, marked in the panel. */
  reproduced: string | null;
  t: Translate;
  locale: Locale;
}) {
  const calc = data.calculation;
  const { locality, premisesClass, scope } = calc.classification;
  const declared = locality.basis === "DECLARED" || premisesClass.basis === "DECLARED";
  return (
    <Panel gap="xl" density="console" locale={locale}>
      <Panel variant="plain" level={2} title={t("tar09.inputs")} compact density="console" locale={locale}>
        <FactList
          columns={2}
          density="console"
          locale={locale}
          items={[
            {
              label: t("tar09.answered"),
              value: calc.answered.kind === "review" ? calc.answered.application : calc.answered.reference,
              kind: "id",
              ...(calc.reproduces !== null
                ? { note: t("tar09.reproductionOf", { ref: calc.reproduces.reference }) }
                : calc.answered.kind === "correction"
                  ? {
                      note: t(calc.answered.case !== null ? "tar09.correctionOfCase" : "tar09.correctionOf", {
                        decision: calc.answered.decision,
                        case: calc.answered.case ?? "",
                      }),
                    }
                  : {}),
            },
            ...calc.inputs.map((input) => ({
              label: t(`tar.fact.${input.fact}`),
              value: factValue(input, t, locale),
              provenance: input.source === "register" ? ("registry-sourced" as const) : ("declared" as const),
            })),
            {
              label: t("tar09.claims"),
              value:
                calc.claims.length === 0
                  ? t("tar09.claimNone")
                  : calc.claims
                      .map((claim) => {
                        const layer = COMPONENT_CODE[claim.layer];
                        if (claim.state === "NOT_ACCEPTED") return t("tar09.claimNotAccepted", { layer });
                        if (claim.state === "UNDER_REVIEW" || claim.accepted === null) return t("tar09.claimUnderReview", { layer });
                        const span = period(claim.accepted.from, claim.accepted.to, locale);
                        return t(claim.state === "ACCEPTED" ? "tar09.claimAccepted" : "tar09.claimPartly", { layer, period: span });
                      })
                      .join("; "),
            },
          ]}
        />
        {calc.inputs.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t("tar09.inputsNone")}
          </Text>
        ) : null}
      </Panel>
      <Divider />
      <Panel variant="plain" level={2} title={t("tar09.classification")} compact density="console" locale={locale}>
        {declared ? <Banner family="attention" title={t("tar09.declaredNote")} compact density="console" locale={locale} /> : null}
        <FactList
          columns={2}
          density="console"
          locale={locale}
          items={[
            {
              label: t("tar09.locality"),
              value: locality.class !== null && locality.basis !== null ? { family: basisFamily(locality.basis), label: `${localityCode(locality.class)} ${locality.basis}`, plain: true } : null,
              kind: locality.class !== null ? "status" : "text",
            },
            {
              label: t("tar09.premisesClass"),
              value:
                premisesClass.class !== null && premisesClass.basis !== null
                  ? { family: basisFamily(premisesClass.basis), label: `${premisesClassCode(premisesClass.class)} ${premisesClass.basis}`, plain: true }
                  : null,
              kind: premisesClass.class !== null ? "status" : "text",
            },
            { label: t("tar09.scope"), value: scope, kind: "mono" },
            { label: t("tar09.transition"), value: calc.transitionRule, kind: "mono" },
          ]}
        />
      </Panel>
      <Divider />
      {scope === "IN_SCOPE" ? <Figures calc={calc} t={t} locale={locale} /> : <Text size="base">{t(scope === "OUT_OF_SCOPE" ? "tar09.outOfScope" : "tar09.indeterminate")}</Text>}
      <Divider />
      <Reproductions data={data} attempt={attempt} reproduced={reproduced} t={t} locale={locale} />
      <Divider />
      <ButtonRow align="between">
        <ButtonRow>
          <Button variant="secondary" size="sm" href={routes.opsTariff({ premises: calc.premises.id })} locale={locale}>
            {t("tar09.back")}
          </Button>
          {data.declaredWatch ? (
            <Button variant="quiet" size="sm" href={routes.opsDeclaredClasses({ premises: calc.premises.id })} locale={locale}>
              {t("tar09.watch")}
            </Button>
          ) : null}
        </ButtonRow>
        <form action={reproduceAct}>
          <input type="hidden" name="calculation" value={calc.reference} />
          <Button variant="primary" size="sm" type="submit" icon="refresh-cw" {...reproduceState(data, t)} locale={locale}>
            {t("tar09.reproduce")}
          </Button>
        </form>
      </ButtonRow>
    </Panel>
  );
}

/** Reproduce is the finance operator's and the auditor's, and only for a calculation a fee rests on; otherwise it says why. */
function reproduceState(data: CalculationPage, t: Translate): { disabled?: boolean; disabledReason?: string } {
  if (!data.mayReproduce) return { disabled: true, disabledReason: t("tar09.reproduceWho") };
  if (data.calculation.purpose !== "PRODUCTION") return { disabled: true, disabledReason: t("tar09.reproduceProduction") };
  return {};
}

/** The components, the exemption condition by condition, the cap and the rounding. */
function Figures({ calc, t, locale }: { calc: Calculation; t: Translate; locale: Locale }) {
  const amount = calc.amountMinor ?? 0;
  return (
    <>
      <Panel variant="plain" level={2} title={t("tar09.components")} compact density="console" locale={locale}>
        <Table
          columns={[
            { key: "code", label: t("tar09.cCode"), kind: "mono" },
            { key: "layer", label: t("tar09.cLayer") },
            { key: "share", label: t("tar09.cShare"), missing: "-" },
            { key: "factors", label: t("tar09.cFactors"), kind: "stack" },
            { key: "before", label: t("tar09.cBeforeCap"), kind: "money", unit: "VND" },
            { key: "amount", label: t("tar09.cAmount"), kind: "money", unit: "VND" },
            { key: "treatment", label: t("tar09.cTreatment"), kind: "stack" },
          ]}
          rows={calc.components.map((component) => ({
            _key: component.layer,
            code: COMPONENT_CODE[component.layer],
            layer: t(`tar.layer.${component.layer}`),
            share: component.shareHundredths !== null ? hundredths(component.shareHundredths, locale) : null,
            factors:
              component.factors.length > 0
                ? { text: component.factors.map((factor) => factorLine(factor, t, locale)).join("; ") }
                : { text: t("tar09.noFactors"), muted: true },
            before: component.amountBeforeCapMinor,
            amount: component.amountMinor,
            treatment: {
              text: component.authority !== null ? `${component.treatment} ${component.authority}` : component.treatment,
              mono: true,
              // DR-322's reason code under the treatment; a pending claim says so too.
              detail: component.claimPending ? t("tar09.reasonPending", { reason: component.reason }) : t("tar09.reason", { reason: component.reason }),
            },
          }))}
          totals={{ label: t("tar09.amount"), values: { amount } }}
          rowHeaders
          density="console"
          caption={t("tar09.components")}
          locale={locale}
        />
      </Panel>
      <Divider />
      <Panel variant="plain" level={2} title={t("tar09.exemptions")} compact density="console" locale={locale}>
        {calc.exemptions.map((exemption) => (
          <Table
            key={exemption.code}
            columns={[
              { key: "criterion", label: t("tar09.cCriterion"), kind: "stack" },
              { key: "value", label: t("tar09.cValue") },
              { key: "met", label: t("tar09.cMet"), kind: "status" },
            ]}
            rows={exemption.criteria.map((criterion) => ({
              _key: criterion.criterion,
              criterion: { text: `${criterion.criterion} ${criterion.fact} LE ${String(criterion.atMost)}`, mono: true, detail: t(`tar.criterion.${criterion.fact}`, { limit: criterion.atMost }) },
              value:
                criterion.value === null
                  ? null
                  : criterion.fact === "FLOOR_AREA_M2"
                    ? t("tar.squareMetres", { n: criterion.value })
                    : t("tar.seats", { n: criterion.value }),
              met:
                criterion.value === null
                  ? { family: "attention", label: t("tar09.notInInputs") }
                  : criterion.met
                    ? { family: "positive", label: t("tar09.met") }
                    : { family: "neutral", label: t("tar09.notMet") },
            }))}
            caption={t(exemption.applied ? "tar09.exemptionApplied" : "tar09.exemptionNotApplied", { code: exemption.code })}
            density="console"
            locale={locale}
          />
        ))}
      </Panel>
      <Divider />
      <Panel variant="plain" level={2} title={t("tar09.capRounding")} compact density="console" locale={locale}>
        <FactList
          columns={2}
          density="console"
          locale={locale}
          items={[
            {
              label: t("tar09.cap"),
              value: calc.cap.applied
                ? t("tar09.capApplied", { cap: money(calc.cap.capMinor, locale), before: money(calc.amountBeforeCapMinor, locale) })
                : t("tar09.underCap", { cap: money(calc.cap.capMinor, locale) }),
            },
            { label: t("tar09.rounding"), value: t("tar09.roundingValue", { unit: money(calc.rounding.unitMinor, locale) }) },
            { label: t("tar09.beforeRounding"), value: { amountMinor: calc.rounding.beforeMinor, currency: "VND" }, kind: "money" },
            { label: t("tar09.amount"), value: { amountMinor: amount, currency: "VND" }, kind: "money" },
          ]}
        />
      </Panel>
    </>
  );
}

function Reproductions({
  data,
  attempt,
  reproduced,
  t,
  locale,
}: {
  data: CalculationPage;
  attempt: ReproduceAttempt | null;
  reproduced: string | null;
  t: Translate;
  locale: Locale;
}) {
  const refusal = attempt?.code ?? null;
  const known = refusal === "NOT_AUTHORISED" || refusal === "CALCULATION_NOT_FOUND" || refusal === "REFERENCE_DATA_UNAVAILABLE" ? refusal : null;
  return (
    <Panel variant="plain" level={2} title={t("tar09.reproductions")} compact density="console" locale={locale}>
      {refusal !== null ? (
        <Banner
          family="attention"
          title={known !== null ? t(`tar.refusal.${known}.title`) : t("tar.errTitle")}
          code={refusal}
          live
          density="console"
          locale={locale}
        >
          {known !== null ? t(`tar.refusal.${known}.text`) : t("tar.errText")}
        </Banner>
      ) : null}
      <Table
        columns={[
          { key: "ref", label: t("tar09.cReproduction"), kind: "id" },
          { key: "at", label: t("tar09.cAt"), kind: "datetime" },
          { key: "by", label: t("tar09.cBy") },
          { key: "outcome", label: t("tar09.cOutcome"), kind: "status" },
        ]}
        rows={data.reproductions.map((reproduction) => ({
          _key: reproduction.reference,
          _href: routes.opsCalculation(reproduction.reference),
          ...(reproduction.reference === reproduced ? { _selected: true } : {}),
          ref: reproduction.reference,
          at: reproduction.createdAt,
          by: t(`tar09.by.${reproduction.requestedBy}`),
          outcome: {
            family: reproduction.outcome === "MATCH" ? "positive" : "danger",
            label: reproduction.outcome,
            ...(reproduction.differences.length > 0
              ? { detail: reproduction.differences.map((difference) => t("tar09.difference", difference)).join("; ") }
              : {}),
          },
        }))}
        empty={{ variant: "not-started", title: t("tar09.reproductionsNone"), action: false }}
        density="console"
        caption={t("tar09.reproductions")}
        locale={locale}
      />
    </Panel>
  );
}

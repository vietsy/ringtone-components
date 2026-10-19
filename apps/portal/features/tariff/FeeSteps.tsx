import type { ReactNode } from "react";
import { Banner, Breakdown, Button, ButtonRow, FactList, MetricValue, Panel, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { day, factorLine, factValue, hundredths, money } from "@/features/tariff/console";
import { PrintButton } from "@/features/tariff/PrintButton";
import type { Calculation, ExemptionTested } from "@/lib/api/tariff";
import type { Locale, Translate } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";

/**
 * SCR-TAR-14's body, whichever screen it was opened from: the decision (SCR-REG-08) or the review of a draft
 * (SCR-REG-05). The page says where Back goes; the steps, the refusals and the header line are the same on both.
 */

/** Where the page's Back control goes, with its words: the decision, or the review it was opened from. */
export interface FeeBack {
  href: string;
  label: string;
}

/** The refusals that replace the page body, each with the way back. */
const REFUSALS = ["NOT_AUTHORISED_FOR_PREMISES", "CALCULATION_NOT_FOUND", "NOT_AUTHORISED"] as const;

/** The header line: the day calculated for and the instrument the tariff was issued with, then the reference. */
export function feeHeader(calc: Calculation, t: Translate, locale: Locale): string {
  const date = day(calc.decisionDate, locale);
  const header = calc.instrument !== null ? t("tar14.header", { date, instrument: calc.instrument }) : t("tar14.headerPlain", { date });
  return `${header} ${t("tar14.reference", { ref: calc.reference })}`;
}

/** A read that failed: its refusal in place of the body with the way back, or the error with its trace. */
export function FeeUnavailable({
  failure,
  back,
  phone,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  back: FeeBack;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const refusal = REFUSALS.find((code) => code === failure.code);
  if (refusal === undefined) {
    return (
      <ViewState
        view="error"
        errorTitle={t("tar.errTitle")}
        errorText={t("tar.errText")}
        {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
        retryable={failure.retryable}
        level={2}
        density="portal"
        locale={locale}
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: phone ? "stretch" : "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
      <ViewState
        view="refused"
        refusal={{ code: refusal, title: t(`tar.refusal.${refusal}.title`), text: t(`tar.refusal.${refusal}.text`), family: "attention" }}
        level={2}
        density="portal"
        locale={locale}
      />
      <Button variant="secondary" size="md" href={back.href} fullWidth={phone} locale={locale}>
        {back.label}
      </Button>
    </div>
  );
}

function Step({ n, title, inset, children, locale, t }: { n: number; title: string; inset: "sm" | "md"; children: ReactNode; locale: Locale; t: Translate }) {
  return (
    <Panel title={t("tar14.stepTitle", { n, title })} level={2} inset={inset} density="portal" locale={locale}>
      {children}
    </Panel>
  );
}

/** The six steps in the order the calculator took them, the amount to pay, and Back and Print. */
export function FeeSteps({ calc, back, frame, t, locale }: { calc: Calculation; back: FeeBack; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const { locality, premisesClass, scope } = calc.classification;
  const shared = calc.components.filter((component) => component.shareHundredths !== null);
  const declared = premisesClass.basis === "DECLARED" || locality.basis === "DECLARED";
  const amount = calc.amountMinor;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
      <Step n={1} title={t("tar14.s1")} inset={inset} t={t} locale={locale}>
        {calc.inputs.length > 0 ? (
          <FactList
            density="portal"
            provenanceWords="plain"
            locale={locale}
            items={calc.inputs.map((input) => ({
              label: t(`tar.fact.${input.fact}`),
              value: factValue(input, t, locale),
              provenance: input.source === "register" ? ("registry-sourced" as const) : ("declared" as const),
            }))}
          />
        ) : (
          <Text size="base">{t("tar14.noFacts")}</Text>
        )}
      </Step>
      <Step n={2} title={t("tar14.s2")} inset={inset} t={t} locale={locale}>
        {locality.class !== null || premisesClass.class !== null ? (
          <FactList
            density="portal"
            locale={locale}
            items={[
              ...(locality.class !== null && locality.basis !== null
                ? [{ label: t("tar14.locality"), value: t("tar14.localityClass", { n: locality.class }), note: t(`tar14.basis.${locality.basis}`) }]
                : []),
              ...(premisesClass.class !== null && premisesClass.basis !== null
                ? [{ label: t("tar.fact.premises_class"), value: t(`tar.class.${premisesClass.class}`), note: t(`tar14.basis.${premisesClass.basis}`) }]
                : []),
            ]}
          />
        ) : (
          <Text size="base">{t("tar14.noClass")}</Text>
        )}
        {declared ? (
          <Banner family="info" density="premises" locale={locale}>
            {t("tar14.declaredNote")}
          </Banner>
        ) : null}
      </Step>
      {scope === "IN_SCOPE" && amount !== null ? (
        <>
          <Step n={3} title={t("tar14.s3")} inset={inset} t={t} locale={locale}>
            {calc.baseAmountMinor !== null && shared.length > 0 ? <Text size="base">{t("tar14.base", { base: money(calc.baseAmountMinor, locale) })}</Text> : null}
            <Breakdown
              title={t("tar14.layersTitle")}
              level={3}
              lines={[
                ...calc.components.map((component) => ({
                  label: t(`tar.layer.${component.layer}`),
                  detail: component.claimPending ? t("tar14.claimPending") : t(`tar14.treatment.${component.treatment}`),
                  amountMinor: component.amountMinor,
                })),
                { label: t("tar14.layersTotal"), kind: "total" as const, amountMinor: calc.rounding.beforeMinor },
              ]}
              locale={locale}
            />
            {shared.length > 0 ? (
              <FactList
                density="portal"
                locale={locale}
                items={shared.map((component) => ({
                  label: t("tar14.share", { layer: t(`tar.layer.${component.layer}`), share: hundredths(component.shareHundredths ?? 0, locale) }),
                  value: component.factors.map((factor) => factorLine(factor, t, locale)).join("; "),
                }))}
              />
            ) : null}
          </Step>
          <Step n={4} title={t("tar14.s4")} inset={inset} t={t} locale={locale}>
            {calc.exemptions.map((exemption) => (
              <Exemption key={exemption.code} exemption={exemption} t={t} />
            ))}
          </Step>
          <Step n={5} title={t("tar14.s5")} inset={inset} t={t} locale={locale}>
            <Text size="base">
              {calc.cap.applied
                ? t("tar14.capApplied", { before: money(calc.amountBeforeCapMinor, locale), cap: money(calc.cap.capMinor, locale) })
                : t("tar14.underCap", { cap: money(calc.cap.capMinor, locale) })}
            </Text>
          </Step>
          <Step n={6} title={t("tar14.s6")} inset={inset} t={t} locale={locale}>
            <Text size="base">
              {calc.rounding.beforeMinor === amount
                ? t("tar14.alreadyRound", { unit: money(calc.rounding.unitMinor, locale) })
                : t("tar14.roundedDown", { unit: money(calc.rounding.unitMinor, locale), before: money(calc.rounding.beforeMinor, locale), after: money(amount, locale) })}
            </Text>
          </Step>
          <Panel inset={inset} density="portal" locale={locale}>
            <MetricValue label={t("tar14.total")} value={amount} kind="money" currency="VND" size="lg" locale={locale} />
            <Text size="base" tone="secondary">
              {t("tar14.correction")}
            </Text>
          </Panel>
        </>
      ) : (
        <Panel inset={inset} density="portal" locale={locale}>
          <Text size="base">{t(scope === "INDETERMINATE" ? "tar14.indeterminate" : "tar14.outOfScope")}</Text>
        </Panel>
      )}
      <ButtonRow>
        <Button variant="primary" size="md" href={back.href} fullWidth={phone} locale={locale}>
          {back.label}
        </Button>
        <PrintButton label={t("tar14.print")} fullWidth={phone} locale={locale} />
      </ButtonRow>
    </div>
  );
}

/** The exemption, applied or not, then each condition with the premises' value, met or not. */
function Exemption({ exemption, t }: { exemption: ExemptionTested; t: Translate }) {
  const valueOf = (criterion: ExemptionTested["criteria"][number]): string | null => {
    if (criterion.value === null) return null;
    return criterion.fact === "FLOOR_AREA_M2" ? t("tar.squareMetres", { n: criterion.value }) : t("tar.seats", { n: criterion.value });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <Text size="base" weight="semibold">
        {t("tar14.exemption", { result: t(exemption.applied ? "tar14.applied" : "tar14.notApplied") })}
      </Text>
      {exemption.criteria.map((criterion) => {
        const condition = t(`tar.criterion.${criterion.fact}`, { limit: criterion.atMost });
        const value = valueOf(criterion);
        return (
          <Text key={criterion.criterion} size="base">
            {value === null
              ? t("tar14.conditionMissing", { condition })
              : t(criterion.met ? "tar14.conditionMet" : "tar14.conditionNotMet", { condition, value })}
          </Text>
        );
      })}
    </div>
  );
}

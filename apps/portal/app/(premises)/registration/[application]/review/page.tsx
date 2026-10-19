import { redirect } from "next/navigation";
import { Banner, Button, ButtonRow, Disclosure, Divider, FactList, ItemList, Panel, Skeleton, StatusLine, Table } from "@/components/r1";
import { Text } from "@/components/Text";
import { DraftFrame, DraftUnavailable, StepError } from "@/features/registration/DraftFrame";
import { MissingBanner } from "@/features/registration/MissingBanner";
import { count, day, daysOpen, moment, regTranslator, span } from "@/features/registration/copy";
import { loadApplicationDraft, loadReviewStep, type ReviewStep } from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG05_VIEWS } from "@/lib/mock/registration";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** Every 503 is a read RightOne could not make: one banner, the catalogue's words, and Review again. */
const UNAVAILABLE: Readonly<Record<string, { title: string; text: string; off: string }>> = {
  TARIFF_UNAVAILABLE: { title: "reg05.unavTitle", text: "reg05.unavText", off: "reg05.offUnav" },
  PREMISES_READ_UNAVAILABLE: { title: "reg.refusal.PREMISES_READ_UNAVAILABLE.title", text: "reg.refusal.PREMISES_READ_UNAVAILABLE.text", off: "reg05.offPru" },
  POLICY_READ_UNAVAILABLE: { title: "reg05.polTitle", text: "reg05.polText", off: "reg05.offPol" },
  DATA_GOVERNANCE_UNAVAILABLE: { title: "reg.refusal.DATA_GOVERNANCE_UNAVAILABLE.title", text: "reg.refusal.DATA_GOVERNANCE_UNAVAILABLE.text", off: "reg05.offDgu" },
};

/** Rules that stop the review: every panel goes, the banner says why. */
const BLOCKED_OFF: Readonly<Record<Exclude<NonNullable<ReviewStep["blocked"]>, "REQUIRED_ITEMS_MISSING">, { family: "neutral" | "attention"; off: string }>> = {
  RULEBOOK_NOT_APPROVED: { family: "neutral", off: "reg05.offRna" },
  USE_START_REQUIRED: { family: "attention", off: "reg05.offUsr" },
  RULEBOOK_EXCEEDS_FACT_LIMIT: { family: "attention", off: "reg05.offLim" },
};

const SECTIONS = [1, 2, 3, 4, 5, 6];

/**
 * SCR-REG-05 Review and explanation. The fee by rights layer, the time before registration, the payment
 * deadline and the explanation the person confirms against on the next step. Opening it is the review
 * itself: what it shows is recorded, and the confirmation on SCR-REG-06 rests on it.
 */
export default async function ReviewPage({
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
  const view = reviewView(query, REG05_VIEWS);
  const draft = await loadApplicationDraft(principal.sessionId, application, "review", view);
  if (draft.failure?.code === "APPLICATION_NOT_EDITABLE") redirect(routes.application(application));
  const outcome = draft.failure !== null || view === "loading" ? null : await loadReviewStep(principal.sessionId, application, view);
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const unavailable = failure !== null ? UNAVAILABLE[failure.code] : undefined;
  const phone = frame === "phone";
  const reference = draft.data?.reference ?? application;

  return (
    <DraftFrame
      step="review"
      reference={application}
      draft={draft.data}
      title={t("reg05.title")}
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
            action={{ label: t("reg05.again"), variant: "primary", icon: "refresh-cw", href: routes.applicationReview(reference) }}
            density="portal"
            locale={locale}
          >
            {t(unavailable.text)}
          </Banner>
          <ButtonRow>
            <Button variant="secondary" size="md" disabled disabledReason={t(unavailable.off)} fullWidth={phone} locale={locale}>
              {t("reg05.next")}
            </Button>
            <Button variant="secondary" size="md" href={routes.applicationFacts(reference)} fullWidth={phone} locale={locale}>
              {t("reg05.change")}
            </Button>
            <Button variant="quiet" size="md" href={routes.applicationEvidence(reference)} fullWidth={phone} locale={locale}>
              {t("reg05.back")}
            </Button>
          </ButtonRow>
        </>
      ) : null}

      {failure !== null && unavailable === undefined ? <StepError failure={failure} t={t} locale={locale} /> : null}

      {draft.failure === null && view === "loading" ? (
        <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <StatusLine family="info" text={t("reg05.working")} cutout="surface" locale={locale} />
          <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
          <Divider />
          <Skeleton variant="table" rows={3} columns={3} density="portal" locale={locale} />
          <Divider />
          <Skeleton variant="text" rows={2} density="portal" locale={locale} />
          <Divider />
          <Skeleton variant="card" rows={3} density="portal" locale={locale} />
        </Panel>
      ) : null}

      {step !== null ? (
        <Review step={step} reference={reference} openSection={view === "section-open" ? 2 : null} phone={phone} t={t} locale={locale} />
      ) : null}
    </DraftFrame>
  );
}

function Review({
  step,
  reference,
  openSection,
  phone,
  t,
  locale,
}: {
  step: ReviewStep;
  reference: string;
  /** The explanation's section drawn open; null leaves every section closed. */
  openSection: number | null;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { blocked, told, fee } = step;
  const nextReason = !step.explanation.published
    ? t("reg05.offExpl")
    : step.feeRefusal !== null
      ? t("reg05.offTna")
      : blocked === "REQUIRED_ITEMS_MISSING"
        ? t("reg05.offMiss")
        : blocked !== null
          ? t(BLOCKED_OFF[blocked].off)
          : null;

  return (
    <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      {blocked === "REQUIRED_ITEMS_MISSING" ? (
        <>
          <MissingBanner items={step.missing} reference={reference} t={t} locale={locale} />
          <Divider />
        </>
      ) : null}
      {blocked !== null && blocked !== "REQUIRED_ITEMS_MISSING" ? (
        <>
          <Banner family={BLOCKED_OFF[blocked].family} title={t(`reg.refusal.${blocked}.title`)} code={blocked} density="portal" locale={locale}>
            {t(`reg.refusal.${blocked}.text`)}
          </Banner>
          <Divider />
        </>
      ) : null}

      {blocked === null && told !== null ? (
        <>
          <Panel
            variant="plain"
            level={2}
            title={t("reg05.toldTitle")}
            actions={[{ label: t("reg05.change"), href: routes.applicationFacts(reference), variant: "secondary" }]}
            density="portal"
            locale={locale}
          >
            <FactList
              items={[
                ...(told.premisesClass !== null
                  ? [{ label: t("reg.question.premises_class"), value: t(`reg.class.${told.premisesClass}`), provenance: "declared" as const }]
                  : []),
                { label: t("reg.question.customer_area"), value: t("reg.area", { n: count(told.customerArea, locale) }), provenance: "declared" },
                { label: t("reg.question.days_open"), value: daysOpen(told.daysOpen, t, locale), provenance: "declared" },
                { label: t("reg.question.music_method"), value: t(`reg.music.${told.musicMethod}`), provenance: "declared" },
                { label: t("reg.question.use_began_on"), value: told.useBeganOn, kind: "date", provenance: "declared" },
              ]}
              columns={phone ? 1 : 2}
              provenanceWords="plain"
              density="portal"
              locale={locale}
            />
          </Panel>
          <Divider />
          {step.feeRefusal !== null ? (
            <>
              <Banner family="neutral" title={t(`reg.refusal.${step.feeRefusal}.title`)} code={step.feeRefusal} density="portal" locale={locale}>
                {t(`reg.refusal.${step.feeRefusal}.text`)}
              </Banner>
              <Divider />
            </>
          ) : null}
          {fee !== null ? (
            <>
              <Panel
                variant="plain"
                level={2}
                title={t("reg05.feeFor", { period: span(fee.period, locale) })}
                // SCR-TAR-14 from the review: the calculation this review recorded, step by step.
                {...(step.calculation !== undefined && step.calculation !== null && step.calculation !== ""
                  ? { actions: [{ label: t("reg05.howCalculated"), href: routes.reviewFeeCalculation(reference, step.calculation), variant: "secondary" as const }] }
                  : {})}
                density="portal"
                locale={locale}
              >
                <Table
                  columns={
                    phone
                      ? [
                          { key: "layer", label: t("reg05.colLayer"), kind: "stack", detailSize: "sm" },
                          { key: "amount", label: t("reg05.colAmount"), kind: "money" },
                        ]
                      : [
                          { key: "layer", label: t("reg05.colLayer") },
                          { key: "amount", label: t("reg05.colAmount"), kind: "money" },
                          { key: "note", label: t("reg05.colNote"), missing: t("reg05.charged") },
                        ]
                  }
                  rows={fee.lines.map((line) => {
                    const layer = t(`reg.layer.${line.layer}`);
                    const note = line.claimPending ? t("reg.pending") : line.treatment !== undefined && line.treatment !== null ? t(`reg08.treatment.${line.treatment}`) : null;
                    return {
                      _key: line.layer,
                      amount: { amountMinor: line.amountMinor, currency: fee.currency },
                      ...(phone
                        ? { layer: { text: layer, plain: true, ...(note !== null ? { detail: note } : {}) } }
                        : { layer, note }),
                    };
                  })}
                  totals={{ label: t("reg.total"), values: { amount: { amountMinor: fee.totalMinor, currency: fee.currency } } }}
                  rowHeaders
                  density="portal"
                  locale={locale}
                />
                <Text size="sm" tone="secondary">
                  {t("reg05.tariff", { version: fee.tariffVersion, ts: moment(fee.workedOutAt, locale) })}
                </Text>
                {step.declaredClass ? <StatusLine family="info" text={t("reg05.classLine")} cutout="surface" locale={locale} /> : null}
                {step.exemption !== null ? (
                  <Panel
                    variant="sunken"
                    level={3}
                    title={t("reg05.exTitle")}
                    description={t(step.exemption.every((criterion) => criterion.met) ? "reg05.exApplied" : "reg05.exText")}
                    inset={phone ? "sm" : "md"}
                    density="portal"
                    locale={locale}
                  >
                    <ItemList
                      items={step.exemption.map((criterion) => {
                        const family = criterion.met ? ("positive" as const) : ("attention" as const);
                        const detail =
                          criterion.criterion === "AREA_UNDER_100"
                            ? t("reg05.c1d", { area: t("reg.area", { n: count(criterion.declaredArea, locale) }) })
                            : criterion.criterion === "ONE_PREMISES"
                              ? t("reg05.c2d", { count: count(criterion.premisesInRegister, locale), party: criterion.party })
                              : criterion.criterion === "RECORDED_SPEAKERS_ONLY"
                                ? t("reg05.c3d", { music: lowerFirst(t(`reg.music.${criterion.declared}`), locale) })
                                : criterion.value === null
                                  ? t("reg05.cNone")
                                  : t(`reg05.cValue.${criterion.criterion}`, { n: count(criterion.value, locale) });
                        return {
                          key: criterion.criterion,
                          title: t(`reg05.criterion.${criterion.criterion}`, "atMost" in criterion ? { limit: count(criterion.atMost, locale) } : {}),
                          detail,
                          family,
                          status: { family, label: t(criterion.met ? "reg05.met" : "reg05.notMet") },
                        };
                      })}
                      readOnly
                      label={t("reg05.exTitle")}
                      density="portal"
                      locale={locale}
                    />
                  </Panel>
                ) : null}
              </Panel>
              <Divider />
            </>
          ) : null}
          {step.outcome !== undefined && step.outcome !== null && step.outcome.kind !== "PAYABLE" ? (
            <>
              <StatusLine
                family={step.outcome.kind === "UNDER_REVIEW" ? "attention" : "info"}
                text={t(step.outcome.kind === "UNDER_REVIEW" ? `reg05.outcome.${step.outcome.reason}` : `reg05.outcome.${step.outcome.basis}`)}
                cutout="surface"
                locale={locale}
              />
              <Divider />
            </>
          ) : null}
          {fee !== null || (step.outcome !== undefined && step.outcome !== null) ? (
            <>
              <Panel variant="plain" level={2} title={t("reg.beforeTitle")} density="portal" locale={locale}>
                <Text size="base">
                  {beforeWords(step, told.useBeganOn, t, locale)}
                </Text>
                {step.payBy !== null ? (
                  <Text size="base" weight="medium">
                    {t("reg05.payBy", { date: day(step.payBy, locale), from: day(told.useBeganOn, locale) })}
                  </Text>
                ) : null}
              </Panel>
              <Divider />
              <Panel
                variant="plain"
                level={2}
                title={t("reg05.meansTitle", { version: count(step.explanation.version, locale) })}
                // The Vietnamese text is the one that applies; only a translation says so.
                {...(locale === "en" ? { description: t("reg05.meansDesc") } : {})}
                density="portal"
                locale={locale}
              >
                {!step.explanation.published ? (
                  <StatusLine family="neutral" text={t("reg05.partial")} cutout="surface" locale={locale} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {SECTIONS.map((section) => (
                      <Disclosure
                        key={section}
                        title={t(`reg05.section${section}.title`)}
                        {...(openSection === section ? { open: true } : {})}
                        level={3}
                        density="portal"
                        locale={locale}
                      >
                        <Text size="base">
                          {t(`reg05.section${section}.body`, { days: count(step.explanation.changeReportDays, locale) })}
                        </Text>
                      </Disclosure>
                    ))}
                  </div>
                )}
              </Panel>
              <Divider />
            </>
          ) : null}
        </>
      ) : null}

      <ButtonRow>
        <Button
          variant={blocked === "REQUIRED_ITEMS_MISSING" ? "secondary" : "primary"}
          size="md"
          href={routes.applicationSubmit(reference)}
          disabled={nextReason !== null}
          {...(nextReason !== null ? { disabledReason: nextReason } : {})}
          fullWidth={phone}
          locale={locale}
        >
          {t("reg05.next")}
        </Button>
        {blocked !== null ? (
          <Button variant="secondary" size="md" href={routes.applicationFacts(reference)} fullWidth={phone} locale={locale}>
            {t("reg05.change")}
          </Button>
        ) : null}
        <Button variant="quiet" size="md" href={routes.applicationEvidence(reference)} fullWidth={phone} locale={locale}>
          {t("reg05.back")}
        </Button>
      </ButtonRow>
    </Panel>
  );
}

/**
 * The time before registration, as DR-22 decided it (SCR-REG-05's words for each outcome): nothing to consider, the
 * amnesty, or nothing raised now with the date kept. A design state carries no treatment and reads as the last.
 */
function beforeWords(step: ReviewStep, useBeganOn: string, t: Translate, locale: Locale): string {
  const before = step.preRegistration ?? null;
  if (before?.treatment === "NO_PRE_REGISTRATION_PERIOD") return t("reg05.before.NO_PRE_REGISTRATION_PERIOD");
  if (before?.treatment === "AMNESTY_APPLIED" && before.amnesty !== null) {
    return t("reg05.before.AMNESTY_APPLIED", { version: before.amnesty.version, period: span(before.amnesty.period, locale), date: day(useBeganOn, locale) });
  }
  return t("reg05.beforeText", { date: day(useBeganOn, locale) });
}

/** "Speakers, recorded music" read inside a sentence: "You declared speakers, recorded music." */
function lowerFirst(text: string, locale: Locale): string {
  return text.charAt(0).toLocaleLowerCase(locale) + text.slice(1);
}

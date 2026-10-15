import {
  Banner,
  Button,
  ButtonRow,
  ChoiceList,
  DateField,
  Divider,
  EmptyState,
  FactList,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  TextField,
  ViewState,
} from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { GatedForm, GatedSubmit } from "@/features/registration/GatedForm";
import { startApplication } from "@/features/registration/actions";
import { regTranslator } from "@/features/registration/copy";
import { readForPage } from "@/lib/api/flash";
import { loadStartApplication, type StartApplication, type StartAttempt } from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG02_VIEWS } from "@/lib/mock/registration";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** The refusals of an attempt to start, each with its own heading; the sentence is the catalogue's. */
const REFUSAL_KEYS: Readonly<Record<string, { title: string; text: string }>> = {
  OPEN_APPLICATION_EXISTS: { title: "reg02.oaeTitle", text: "reg02.oaeText" },
  PREMISES_RELATIONSHIP_NOT_EFFECTIVE: { title: "reg02.relTitle", text: "reg02.relText" },
  NOT_AUTHORISED_FOR_PREMISES: { title: "reg02.naTitle", text: "reg02.naText" },
  PRIOR_DECISION_SUPERSEDED: { title: "reg02.supTitle", text: "reg02.supText" },
  PRIOR_DECISION_NOT_FOUND: { title: "reg02.pnfTitle", text: "reg02.pnfText" },
  PREMISES_READ_UNAVAILABLE: { title: "reg.refusal.PREMISES_READ_UNAVAILABLE.title", text: "reg.refusal.PREMISES_READ_UNAVAILABLE.text" },
  DATA_GOVERNANCE_UNAVAILABLE: { title: "reg.refusal.DATA_GOVERNANCE_UNAVAILABLE.title", text: "reg.refusal.DATA_GOVERNANCE_UNAVAILABLE.text" },
};

/** The refusals that belong to one field, written under it. */
const FIELD_ERROR_KEYS: Readonly<Record<string, string>> = {
  INTENDED_PERIOD_INVALID: "reg02.ipi",
  PRE_REGISTRATION_OBLIGATION_RESERVED: "reg02.pre",
  AMENDMENT_CAUSE_REQUIRED: "reg02.acr",
};

/**
 * SCR-REG-02 Start an application. The person chooses the premises and the period; a renewal or a change
 * starts from the decision it continues, which SCR-REG-08 hands over. The draft has its reference from the
 * start, and SCR-REG-03 opens.
 */
export default async function StartApplicationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = regTranslator(locale);
  // A reviewer's ?view= shows a drawn state; otherwise the form as the last attempt (or SCR-REG-08) left it.
  const view = reviewView(params, REG02_VIEWS);
  const last = readForPage<StartAttempt>(params);
  const outcome = view === "loading" ? null : await loadStartApplication(principal, view, last?.page === "start" ? last : null);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";
  const formWidth = phone ? "100%" : "var(--container-3xl)";

  const form = data !== null && data.premises.length > 0 ? data : null;
  const prior = form?.values.prior ?? null;
  const chosen = form?.premises.find((p) => p.id === form.values.premisesId) ?? null;
  const crumbs = [
    { label: t("reg.crumb"), href: routes.applications() },
    ...(prior !== null ? [{ label: t("reg02.crumbDecision", { ref: prior.reference }), href: routes.decision(prior.reference) }] : []),
  ];

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("applications", frame, locale)}
      account={principal.account}
      {...(chosen !== null ? { context: { premises: chosen.name, ...(prior !== null ? { period: prior.reference } : {}) } } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader crumbs={crumbs} title={t("reg02.title")} locale={locale} />

        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("reg.errTitle")}
            errorText={t("reg.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="portal"
            locale={locale}
          />
        ) : null}

        {view === "loading" ? (
          <div style={{ maxWidth: formWidth }}>
            <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
              <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
              <Divider />
              <Skeleton variant="text" rows={2} density="portal" locale={locale} />
              <Divider />
              <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
            </Panel>
          </div>
        ) : null}

        {/* Acting for no premises is a governed answer: PTY records no delegation for this person. */}
        {data !== null && data.premises.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap, maxWidth: formWidth }}>
            <EmptyState variant="governed" icon="users" title={t("reg02.emptyTitle")} level={2} density="portal" locale={locale}>
              {t("reg02.emptyText")}
            </EmptyState>
            <div>
              <Button variant="secondary" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
                {t("reg02.cancel")}
              </Button>
            </div>
          </div>
        ) : null}

        {form !== null ? (
          <div style={{ maxWidth: formWidth }}>
            <GatedForm
              action={startApplication}
              required={form.values.prior !== null ? [] : ["premises_id"]}
              initiallyMissing={form.values.prior === null && form.values.premisesId === null ? ["premises_id"] : []}
            >
              <StartForm data={form} phone={phone} starting={view === "starting"} t={t} locale={locale} />
            </GatedForm>
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}

function StartForm({ data, phone, starting, t, locale }: { data: StartApplication; phone: boolean; starting: boolean; t: Translate; locale: Locale }) {
  const { values, fieldError, refusal } = data;
  const prior = values.prior;
  const fromDecision = prior !== null;
  const change = values.kind === "AMENDMENT";
  const options = data.premises.map((p) => ({ value: p.id, label: p.name }));
  const premisesValue = values.premisesId ?? "";
  const periodError = fieldError?.field === "period" ? fieldText(fieldError.code, t) : null;
  const causeError = fieldError?.field === "cause" ? fieldText(fieldError.code, t) : null;
  const governing = fieldError?.governingDecision ?? null;
  const dateWidth = phone ? "100%" : "var(--space-64)";
  const refusalKey = refusal !== null ? REFUSAL_KEYS[refusal.code] : undefined;

  return (
    <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      {/* What the form starts from, carried with it: the kind, and for a renewal or a change the decision and its premises. */}
      <input type="hidden" name="kind" value={values.kind} />
      {prior !== null ? <input type="hidden" name="prior_decision_id" value={prior.reference} /> : null}
      {fromDecision && values.premisesId !== null ? <input type="hidden" name="premises_id" value={values.premisesId} /> : null}
      <Panel variant="plain" density="portal" locale={locale}>
        <TextField
          label={t("reg02.actFor")}
          name="acting_for_party_id"
          value={t("reg02.party", { party: data.party })}
          readOnly
          density="portal"
          locale={locale}
        />
        {/* A select cannot wrap, and a premises name is never cut: at phone width the premises are a list of choices. */}
        {!phone || fromDecision ? (
          <Select
            label={t("reg02.premises")}
            name="premises_id"
            options={options}
            value={premisesValue}
            placeholder={t("reg02.choose")}
            required={!fromDecision}
            readOnly={fromDecision}
            width="100%"
            density="portal"
            locale={locale}
          />
        ) : (
          <ChoiceList legend={t("reg02.premises")} name="premises_id" options={options} value={premisesValue} required density="portal" locale={locale} />
        )}
      </Panel>
      <Divider />
      <Panel
        variant="plain"
        level={2}
        title={t(`reg.kind.${values.kind}`)}
        {...(!fromDecision ? { description: t("reg02.newHint") } : {})}
        density="portal"
        locale={locale}
      >
        {prior !== null ? (
          <FactList
            items={[
              { label: t("reg02.decision"), value: prior.reference, kind: "id" },
              { label: t("reg02.decisionPeriod"), value: prior.period, kind: "period" },
            ]}
            density="portal"
            locale={locale}
          />
        ) : null}
        {change ? (
          <ChoiceList
            legend={t("reg02.cause")}
            name="cause"
            options={[
              { value: "FACT_CHANGE_REPORTED", label: t("reg02.causeFact") },
              { value: "APPLICANT_REQUEST", label: t("reg02.causeOther") },
            ]}
            value={values.cause ?? ""}
            required
            {...(causeError !== null ? { error: causeError } : {})}
            density="portal"
            locale={locale}
          />
        ) : null}
      </Panel>
      <Divider />
      <Panel variant="plain" density="portal" locale={locale}>
        {!change ? (
          <DateField
            label={t("reg02.period")}
            range
            fromLabel={t("reg02.from")}
            toLabel={t("reg02.to")}
            name="intended_period"
            value={values.period.from}
            to={values.period.to}
            required
            {...(periodError !== null ? { error: periodError } : {})}
            today={data.today}
            density="portal"
            locale={locale}
          />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--space-4)" }}>
            <DateField
              label={t("reg02.from")}
              name="intended_period_start"
              value={values.period.from}
              required
              today={data.today}
              width={dateWidth}
              density="portal"
              locale={locale}
            />
            <DateField
              label={t("reg02.to")}
              name="intended_period_end"
              value={values.period.to}
              readOnly
              helper={t("reg02.changeTo")}
              width={dateWidth}
              density="portal"
              locale={locale}
            />
          </div>
        )}
        {governing !== null ? (
          <div>
            <Button variant="secondary" size="md" href={routes.decision(governing)} fullWidth={phone} locale={locale}>
              {t("reg02.openGoverning", { ref: governing })}
            </Button>
          </div>
        ) : null}
        <Text size="base" tone="secondary" measure="2xl">
          {t("reg02.periodLine")}
        </Text>
      </Panel>
      <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {refusal !== null ? (
          <Banner
            family="attention"
            title={t(refusalKey?.title ?? "reg.errTitle")}
            code={refusal.code}
            {...(refusal.openApplication !== null
              ? { action: { label: t("reg02.openApp", { ref: refusal.openApplication }), href: routes.application(refusal.openApplication), variant: "secondary" as const } }
              : {})}
            density="portal"
            locale={locale}
          >
            {t(refusalKey?.text ?? "reg.errText")}
          </Banner>
        ) : null}
      </div>
      <ButtonRow>
        <GatedSubmit
          reasons={[{ field: "premises_id", text: t("reg02.chooseFirst") }]}
          variant="primary"
          size="md"
          pending={starting}
          loadingLabel={t("reg02.startingLabel")}
          fullWidth={phone}
          locale={locale}
        >
          {t("reg02.start")}
        </GatedSubmit>
        <Button variant="quiet" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
          {t("reg02.cancel")}
        </Button>
      </ButtonRow>
    </Panel>
  );
}

function fieldText(code: string, t: Translate): string {
  const key = FIELD_ERROR_KEYS[code];
  return key !== undefined ? t(key) : t("reg.errText");
}

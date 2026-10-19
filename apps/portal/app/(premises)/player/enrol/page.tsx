import { Banner, Button, EmptyState, FactList, PageHeader, Panel, TextField, ViewState } from "@/components/r1";
import { enrolPremises } from "@/features/venue/actions";
import { refusalWords, venTranslator } from "@/features/venue/copy";
import { EnrolForm } from "@/features/venue/EnrolForm";
import { LoadError, VenueShell } from "@/features/venue/Frame";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadEnrolForm, type EnrolAttempt } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN01_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** PUB's page on the core licence route, which a refusal for the premises class points to (BR-VEN-08). */
const CORE_LICENCE_ROUTE = "https://rightone.vn/giay-phep";

/**
 * How each enrolment refusal reads: an answer about the premises is neutral, a condition the premises can change is
 * attention. The board's own PREMISES_CLASS_UNRESOLVED (the register holds no class) reads as attention too.
 */
const FAMILY: Readonly<Record<string, "neutral" | "attention">> = {
  PREMISES_CLASS_OUT_OF_SCOPE: "neutral",
  PREMISES_CLASS_UNRESOLVED: "attention",
  PREMISES_RELATIONSHIP_NOT_EFFECTIVE: "attention",
  ALREADY_ENROLLED: "neutral",
  NOT_AUTHORISED_FOR_PREMISES: "neutral",
  SCOPE_UNAVAILABLE: "attention",
};

/**
 * SCR-VEN-01 Enrol a premises. The person chooses one of the premises they act for and learns at once whether it is
 * admitted; refused, the answer takes the result panel, and for a class outside the direct licence it carries the
 * scope and the core licence route. There is no way to ask for an exception, for any code (SEC-251).
 */
export default async function EnrolPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = venTranslator(locale);
  const view = reviewView(params, VEN01_VIEWS);
  const outcome = view === "loading" ? null : await loadEnrolForm(principal, view);
  const attempt = readForPage<EnrolAttempt>(params);
  const answer = attempt?.page === "enrol" ? attempt : null;
  const form = outcome?.data ?? null;
  const phone = frame === "phone";

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={{ premises: principal.party, period: t("ven.role"), label: t("ven.actingFor") }}>
      <PageHeader crumbs={[{ label: t("ven.crumb"), href: routes.player() }]} title={t("ven01.title")} locale={locale} />
      {outcome !== null && outcome.failure !== null ? <LoadError failure={outcome.failure} locale={locale} /> : null}
      {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={3} density="portal" locale={locale} /> : null}
      {form !== null && form.premises.length === 0 ? (
        <EmptyState variant="not-started" title={t("ven01.emptyTitle")} level={2} action={false} density="portal" locale={locale}>
          {t("ven01.emptyText")}
        </EmptyState>
      ) : null}
      {form !== null && form.premises.length > 0 ? (
        <div style={{ maxWidth: "var(--container-3xl)", minWidth: 0 }}>
          <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
            <TextField
              label={t("ven01.actFor")}
              name="acting_for_party_id"
              value={t("ven01.actForValue", { party: form.party })}
              readOnly
              provenance="registry-sourced"
              provenanceWords="plain"
              wrap
              density="portal"
              locale={locale}
            />
            <EnrolForm
              copy={{
                premises: t("ven01.premises"),
                choose: t("ven01.choose"),
                help: t("ven01.premisesHelp"),
                resultLabel: t("ven01.resultLabel"),
                idle: t("ven01.idle"),
                enrol: t("ven01.enrol"),
                chooseFirst: t("ven01.chooseFirst"),
                back: t("ven01.back"),
              }}
              options={form.premises.map((premises) => ({
                value: premises.id,
                label: premises.area === null ? premises.name : t("ven01.option", { name: premises.name, area: premises.area }),
              }))}
              chosen={answer?.premisesId ?? null}
              answeredFor={answer?.premisesId ?? null}
              answer={answer !== null ? <Answer code={answer.code} phone={phone} t={t} locale={locale} /> : null}
              action={enrolPremises}
              backHref={routes.player()}
              phone={phone}
              locale={locale}
            />
          </Panel>
        </div>
      ) : null}
    </VenueShell>
  );
}

/** The refusal in place of the result panel, with the scope and the route when the class is outside the licence. */
function Answer({ code, phone, t, locale }: { code: string; phone: boolean; t: Translate; locale: Locale }) {
  const words = refusalWords(code, t);
  return (
    <>
      <Banner
        family={FAMILY[code] ?? "neutral"}
        title={words.title}
        code={code}
        level={2}
        density="portal"
        {...(code === "ALREADY_ENROLLED" ? { action: { label: t("ven01.open"), href: routes.player(), variant: "secondary" as const } } : {})}
        locale={locale}
      >
        {words.text}
      </Banner>
      {code === "PREMISES_CLASS_OUT_OF_SCOPE" ? (
        <Panel variant="plain" level={3} title={t("ven01.scopeTitle")} gap="sm" density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("ven01.scope"), value: t("ven01.scopeValue") },
              { label: t("ven01.routeLabel"), value: t("ven01.routeValue") },
            ]}
            locale={locale}
          />
          <div style={{ display: "flex" }}>
            <Button variant="secondary" size="md" href={CORE_LICENCE_ROUTE} target="_blank" rel="noopener" iconRight="external-link" fullWidth={phone} locale={locale}>
              {t("ven01.route")}
            </Button>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

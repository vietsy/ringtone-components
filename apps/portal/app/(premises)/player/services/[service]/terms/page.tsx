import {
  Banner,
  Columns,
  ItemList,
  LegalTextViewer,
  Link,
  PageHeader,
  Panel,
  Stepper,
  ViewState,
  Divider,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { acceptTerms } from "@/features/venue/actions";
import { day, moment, refusalWords, serviceStatus, venTranslator } from "@/features/venue/copy";
import { LoadError, RefusedBody, VenueShell } from "@/features/venue/Frame";
import { TermsForm } from "@/features/venue/TermsForm";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadTermsStep, type TermsAttempt, type TermsStep } from "@/lib/api/venue";
import { shownTermsDigest } from "@/lib/api/venue-terms";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN02_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** PUB's page on the core licence route, which a refusal for the premises class points to (BR-VEN-08). */
const CORE_LICENCE_ROUTE = "https://rightone.vn/giay-phep";

/** The acceptance's refusals that are a condition the premises can act on read as attention; the others neutral. */
const ATTENTION: ReadonlySet<string> = new Set(["NO_DEFAULT_CONTENT", "ATTESTATION_NOT_CONFIRMED", "TERMS_VERSION_SUPERSEDED", "PREMISES_CLASS_UNRESOLVED", "SCOPE_UNAVAILABLE"]);

/**
 * SCR-VEN-02 Accept the service terms. The terms in force, as PUB publishes them, with the way to the published
 * text; the rules that decide what plays; and the attestation. Accepted, the service starts and its page opens.
 * Refused NO_DEFAULT_CONTENT, the answer carries the way to set a default, and the person comes back here to accept
 * (spine amendment A1). Terms PUB could not answer are the Error state, and nothing can be accepted (SEC-256).
 */
export default async function TermsPage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN02_VIEWS);
  const outcome = view === "loading" ? null : await loadTermsStep(principal, service, view);
  const last = readForPage<TermsAttempt>(query);
  const attempt = last?.page === "terms" && last.service === service ? last : null;
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={step !== null ? { premises: step.service.premises.name, period: step.service.code } : null}>
      <PageHeader
        crumbs={[
          { label: t("ven.crumb"), href: routes.player() },
          ...(step !== null ? [{ label: step.service.premises.name, href: routes.playerService(service) }] : []),
        ]}
        title={t("ven02.title")}
        {...(step !== null
          ? {
              status: serviceStatus(step.service.status, t),
              meta: t("ven02.meta", { code: step.service.code, ts: moment(step.service.enrolledAt, locale) }),
            }
          : {})}
        locale={locale}
      />
      <Text size="base">{t("ven.line")}</Text>
      {view === "loading" ? <ViewState view="loading" skeleton="text" rows={6} density="portal" locale={locale} /> : null}
      {failure !== null && failure.code === "NOT_AUTHORISED_FOR_PREMISES" ? (
        <RefusedBody code={failure.code} back={{ label: t("ven.backServices"), href: routes.player() }} t={t} locale={locale} />
      ) : failure !== null ? (
        <LoadError failure={failure} locale={locale} />
      ) : null}
      {step !== null ? <Terms step={step} attempt={attempt} frame={frame} t={t} locale={locale} /> : null}
    </VenueShell>
  );
}

function Terms({ step, attempt, frame, t, locale }: { step: TermsStep; attempt: TermsAttempt | null; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const service = step.service;
  const pending = service.status === "PENDING_TERMS";
  // Opened for a service no longer pending, the page says so as the acceptance would.
  const code = attempt?.code ?? (pending ? null : "ENTITLEMENT_NOT_PENDING");
  const rulesRefused = step.rules.refusal !== null;
  const terms = step.terms;
  const steps = [
    { label: t("ven02.stepEnrol"), state: "done" as const },
    { label: t("ven02.stepDefault"), state: step.defaultSet ? ("done" as const) : ("current" as const) },
    { label: t("ven02.stepAccept"), state: step.defaultSet ? ("current" as const) : ("todo" as const) },
    { label: t("ven02.stepActive"), state: "todo" as const },
  ];
  return (
    <Columns single={phone}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          {terms !== null ? (
            <>
              <LegalTextViewer
                title={terms.title[locale]}
                version={terms.version}
                effective={terms.effective}
                sections={terms.sections.map((section) => ({ id: section.id, heading: section.heading[locale], body: section.body[locale] }))}
                showProgress
                locale={locale}
              />
              <Link href={routes.legalDocument("premises-service-terms")} icon="file-text" locale={locale}>
                {t("ven02.published")}
              </Link>
            </>
          ) : (
            <ViewState view="error" errorTitle={t("ven02.termsErrTitle")} errorText={t("ven02.termsErrText")} retryable density="portal" locale={locale} />
          )}
          <Divider />
          {step.rules.disclosure !== null ? (
            <Panel variant="plain" level={2} title={t("ven02.rulesTitle")} gap="sm" density="portal" locale={locale}>
              <ItemList items={[1, 2, 3, 4].map((n) => ({ key: `r${n}`, title: t(`ven02.rule.${n}`) }))} readOnly density="portal" label={t("ven02.rulesTitle")} locale={locale} />
              <Text size="base" tone="secondary">
                {t("ven02.rulesSince", { d: day(step.rules.disclosure.effectiveFrom, locale) })}
              </Text>
            </Panel>
          ) : (
            <Banner family="neutral" title={refusalWords("RULES_NOT_APPROVED", t).title} code="RULES_NOT_APPROVED" level={2} density="portal" locale={locale}>
              {refusalWords("RULES_NOT_APPROVED", t).text}
            </Banner>
          )}
          <Divider />
          {terms !== null ? (
            <TermsForm
              copy={{ attest: t("ven02.attest", { party: step.party, premises: service.premises.name }), attestHint: t("ven02.attestHint"), accept: t("ven02.accept"), untick: t("ven02.untick"), back: t("ven.backServices") }}
              terms={{ version: terms.version, documentId: terms.documentId, digest: shownTermsDigest(terms, locale) }}
              initiallyTicked={attempt?.ticked ?? false}
              attestError={code === "ATTESTATION_NOT_CONFIRMED" ? t("ven.refusal.ATTESTATION_NOT_CONFIRMED") : null}
              blocked={
                rulesRefused
                  ? { reason: t("ven02.noRules"), attestOff: false }
                  : !pending
                    ? { reason: refusalWords("ENTITLEMENT_NOT_PENDING", t).title, attestOff: true }
                    : null
              }
              acceptVariant={code === "NO_DEFAULT_CONTENT" || code === "ENTITLEMENT_NOT_PENDING" ? "secondary" : "primary"}
              refusal={code !== null ? <Refusal code={code} service={service.code} t={t} locale={locale} /> : null}
              action={acceptTerms.bind(null, service.code)}
              backHref={routes.player()}
              phone={phone}
              locale={locale}
            />
          ) : null}
        </Panel>
      </div>
      <Panel as="aside" title={t("ven02.stepsTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Stepper steps={steps} label={t("ven02.stepsTitle")} locale={locale} />
        <Text size="base" tone="secondary">
          {t("ven02.stepsText")}
        </Text>
      </Panel>
    </Columns>
  );
}

/** The acceptance's refusal above the action row, with the way on the board gives it. */
function Refusal({ code, service, t, locale }: { code: string; service: string; t: Translate; locale: Locale }) {
  const words = refusalWords(code, t);
  const action =
    code === "NO_DEFAULT_CONTENT"
      ? { label: t("ven02.setDefault"), href: routes.playerPlaylists(service), variant: "primary" as const }
      : code === "ENTITLEMENT_NOT_PENDING"
        ? { label: t("ven02.openService"), href: routes.playerService(service), variant: "primary" as const }
        : code === "PREMISES_CLASS_OUT_OF_SCOPE"
          ? { label: t("ven01.route"), href: CORE_LICENCE_ROUTE, icon: "external-link", variant: "secondary" as const }
          : null;
  return (
    <Banner family={ATTENTION.has(code) ? "attention" : "neutral"} title={words.title} code={code} level={2} density="portal" {...(action !== null ? { action } : {})} locale={locale}>
      {words.text}
    </Banner>
  );
}

import { Button, ButtonRow, FactList, LegalTextViewer, Link, PageHeader, Panel, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { day, plropsTranslator, said } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { loadAssurancePolicy, type AssurancePolicyView, type AssuranceVersion } from "@/lib/api/player";
import { currentWorld } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR11_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-11 Device-assurance policy, public: the criteria a supplier is judged against, the issuing authority, the
 * validity and the withdrawal grounds of the version in effect, and every earlier version still readable at its own
 * dates. Published because the criteria cannot be a thing only RightOne can read. It reads the browser's world, so a
 * version the evidence console approves and publishes appears here; a draft, or one kept unpublished, does not.
 */
export default async function AssurancePolicyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const [locale, frame, world] = await Promise.all([getLocale(), getFrame(query), currentWorld()]);
  const t = plropsTranslator(locale);
  const phone = frame === "phone";
  const view = reviewView(query, PLR11_VIEWS);
  const asked = typeof query.version === "string" && query.version !== "" ? query.version : null;
  const outcome = view === "loading" ? null : await loadAssurancePolicy(world, asked, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const version = data?.version ?? null;
  const notPublished = failure?.code === "CRITERIA_VERSION_NOT_PUBLISHED";

  const apply = (
    <Button
      variant="primary"
      size="md"
      {...(notPublished ? { disabled: true, disabledReason: t("plr11.applyOff") } : { href: routes.certificationRegister() })}
      fullWidth={phone}
      locale={locale}
    >
      {t("plr10.apply")}
    </Button>
  );
  const close = (
    <Button variant="quiet" size="md" href={routes.home()} fullWidth={phone} locale={locale}>
      {t("plrops.close")}
    </Button>
  );

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          eyebrow={t("plr10.eyebrow")}
          title={t("plr11.title")}
          {...(version !== null
            ? {
                status: version.inEffect ? { family: "positive" as const, label: t("plr11.effective") } : { family: "neutral" as const, label: t("plr11.notEffective") },
                meta: versionMeta(version, t, locale),
              }
            : {})}
          size="public"
          locale={locale}
        />
        {view === "loading" ? <ViewState view="loading" skeleton="text" rows={6} density="portal" locale={locale} /> : null}
        {notPublished ? (
          <ViewState view="refused" refusal={{ code: "CRITERIA_VERSION_NOT_PUBLISHED", title: t("plr11.refTitle"), text: t("plrops.refusal.CRITERIA_VERSION_NOT_PUBLISHED"), family: "neutral" }} density="portal" level={2} locale={locale} />
        ) : failure !== null ? (
          <Failure failure={failure} errorText={t("plr11.errText")} prefix="plrops" density="portal" t={t} locale={locale} />
        ) : null}
        {data !== null ? <Policy data={data} phone={phone} t={t} locale={locale} /> : null}
        {phone ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {apply}
            {close}
          </div>
        ) : (
          <ButtonRow>
            {apply}
            {close}
          </ButtonRow>
        )}
      </div>
    </PublicShell>
  );
}

function versionMeta(version: AssuranceVersion, t: Translate, locale: Locale): string {
  if (version.effectiveTo !== null) return t("plr11.metaEnded", { n: version.no, e: day(version.effectiveFrom, locale), to: day(version.effectiveTo, locale) });
  if (version.publishedOn !== null) return t("plr11.meta", { n: version.no, e: day(version.effectiveFrom, locale), p: day(version.publishedOn, locale) });
  return t("plr11.metaNoPublished", { n: version.no, e: day(version.effectiveFrom, locale) });
}

function Policy({ data, phone, t, locale }: { data: AssurancePolicyView; phone: boolean; t: Translate; locale: Locale }) {
  const version = data.version;
  return (
    <>
      <Text size="lg">{t("plr11.lead")}</Text>
      <Panel title={t("plr11.fixesTitle", { n: version.no })} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("plr11.fCriteria"), value: said(version.criteria, locale) },
            { label: t("plr11.fAuthority"), value: said(version.authority, locale) },
            { label: t("plr11.fValidity"), value: t("plr11.validity", { m: version.validityMonths }) },
            { label: t("plr11.fWithdrawal"), value: said(version.withdrawal, locale) },
          ]}
          density="portal"
          locale={locale}
        />
      </Panel>
      <LegalTextViewer
        title={t("plr11.textTitle")}
        version={String(version.no)}
        effective={version.effectiveFrom}
        sections={version.sections.map((section) => ({ id: section.id, heading: said(section.heading, locale), body: section.body.map((paragraph) => said(paragraph, locale)) }))}
        showProgress={false}
        locale={locale}
      />
      {data.others.length > 0 ? (
        <Panel title={t(version.inEffect ? "plr11.earlierTitle" : "plr11.othersTitle")} level={2} variant="plain" gap="sm" density="portal" locale={locale}>
          {data.others.map((other) => (
            <div key={other.no} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-2)" }}>
              <Text size="base" tone="secondary">
                {other.effectiveTo !== null
                  ? t("plr11.earlier", { n: other.no, e: day(other.effectiveFrom, locale), to: day(other.effectiveTo, locale), m: other.validityMonths })
                  : t("plr11.current", { n: other.no, e: day(other.effectiveFrom, locale), m: other.validityMonths })}
              </Text>
              <Link href={routes.assurancePolicy(other.no)} variant="standalone" size="touch" locale={locale}>
                {t("plr11.read", { n: other.no })}
              </Link>
            </div>
          ))}
        </Panel>
      ) : null}
    </>
  );
}

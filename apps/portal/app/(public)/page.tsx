import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  Button,
  EmptyState,
  FactList,
  ItemList,
  Link,
  NavList,
  PageHeader,
  Panel,
  Skeleton,
  StatusLine,
} from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { publicLayout } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { PageSections } from "@/features/public/PageSections";
import { loadAboutPage, loadHelpRoutes, type AboutPage, type HelpRoute } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { PUB01_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";
import type { LoadOutcome } from "@rightone/ui";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * SCR-PUB-01 What RightOne is: who operates RightOne, on what legal basis, for which rights and
 * organisations, what is not covered and from when. The public site's home: the edition in effect, or, opened from a
 * date in the page's history (SCR-PUB-10, `?at=`), the edition of that instant marked superseded.
 */
export default async function AboutPageRoute({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the page is the version in effect today, or at the instant asked.
  const view = reviewView(params, PUB01_VIEWS);
  const { narrow, gap, inset } = publicLayout(frame);
  const outcome = view === "loading" ? null : await loadAboutPage(view, one(params.at));
  const page = outcome?.data?.page ?? null;
  const failure = outcome?.failure ?? null;
  const superseded = page !== null && page.current !== null;
  // The help routes stand in for the page when no version was published for the instant asked.
  const helpRoutes = outcome !== null && failure === null && page === null ? await loadHelpRoutes() : null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader
          title={t("pub01.title")}
          {...(page !== null
            ? {
                status: superseded ? { family: "neutral" as const, label: t("pub01.notCurrent") } : { family: "positive" as const, label: t("pub01.inEffect") },
                meta: superseded
                  ? t("pub01.metaOld", { version: page.version, date: date(page.asAt, locale) })
                  : t("pub01.metaNow", { version: page.version, date: date(page.effectiveFrom, locale) }),
              }
            : {})}
          size="public"
          locale={locale}
        />

        {view === "loading" ? (
          <Loading inset={inset} t={t} locale={locale} />
        ) : failure !== null ? (
          failure.code === "INSTANT_INVALID" ? (
            <Banner family="attention" title={t("pub01.instantTitle")} code={failure.code} density="portal" locale={locale}>
              {t("pub01.instantText")}
            </Banner>
          ) : (
            <PageError failure={failure} t={t} locale={locale} />
          )
        ) : page === null ? (
          <NoVersion helpRoutes={helpRoutes} inset={inset} t={t} locale={locale} />
        ) : (
          <Page page={page} inset={inset} t={t} locale={locale} />
        )}

        <div>
          <Button variant="primary" size="lg" icon="arrow-right" href={routes.scope()} fullWidth={narrow} locale={locale}>
            {t("pub01.scope")}
          </Button>
        </div>
        <NavList
          title={t("pub.goTitle")}
          items={[
            { label: t("pub01.verify"), detail: t("pub01.verifyD"), icon: "search", href: routes.verify() },
            { label: t("pub01.tariff"), detail: t("pub01.tariffD"), icon: "banknote", href: routes.disclosures() },
            { label: t("pub01.legal"), detail: t("pub01.legalD"), icon: "file-text", href: routes.legalDocument() },
            { label: t("pub.help"), detail: t("pub.helpD"), icon: "circle-help", href: routes.help() },
          ]}
          locale={locale}
        />
      </div>
    </PublicShell>
  );
}

function Page({ page, inset, t, locale }: { page: AboutPage; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const notOffered = <StatusLine family="neutral" text={t("pub01.naTitle")} detail={t("pub01.naText")} locale={locale} />;
  return (
    <>
      {page.upcoming !== null && (
        <StatusLine
          family="info"
          text={t("pub01.upcoming", { version: page.upcoming.version, date: date(page.upcoming.effectiveFrom, locale) })}
          locale={locale}
        />
      )}
      {page.current !== null && (
        <>
          <StatusLine
            family="neutral"
            text={t("pub01.superseded", { version: page.current.version, date: date(page.current.effectiveFrom, locale) })}
            locale={locale}
          />
          <Link href={routes.home()} variant="standalone" size="touch" locale={locale}>
            {t("pub01.readCurrent")}
          </Link>
        </>
      )}
      <Link href={routes.legalDocument(undefined, { history: "page" })} variant="standalone" size="touch" icon="history" locale={locale}>
        {t("pub01.history")}
      </Link>
      {page.newerApprovedVersionExists && (
        <StatusLine
          family="info"
          text={
            page.newerApprovedSources.length > 0
              ? t("pub01.newerOf", { sources: page.newerApprovedSources.map((source) => t(`pub01.source.${source}`)).join(", ") })
              : t("pub01.newer")
          }
          locale={locale}
        />
      )}

      {page.sections.length > 0 ? (
        // The edition's own text, as the policy console published it (FR-PUB-001, FR-PUB-030).
        <PageSections
          sections={page.sections}
          words={{ OPERATOR: t("pub01.section.OPERATOR"), SCOPE: t("pub01.section.SCOPE"), ONE_LAWFUL_ROUTE: t("pub01.routeTitle") }}
          inset={inset}
          locale={locale}
        />
      ) : (
        // An edition the canvas writes into this page's catalogue rather than into the register.
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: "var(--container-2xl)" }}>
            <Text size="base">{t("pub01.body1")}</Text>
            <Text size="base">{t("pub01.body2")}</Text>
          </div>

          <Panel title={t("pub01.routeTitle")} level={2} inset={inset} density="portal" locale={locale}>
            <Text size="base">{t("pub01.routeText")}</Text>
          </Panel>
        </>
      )}

      <Panel title={t("pub01.opTitle")} level={2} inset={inset} density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("pub01.fOperator"), value: page.operator },
            page.collector !== null
              ? { label: t("pub01.fCollector"), value: page.collector }
              : {
                  label: t("pub01.fCollector"),
                  value: { family: "attention", label: t("pub01.pending") },
                  kind: "status",
                  note: t("pub01.collectorNote"),
                },
          ]}
          locale={locale}
        />
      </Panel>

      <Panel title={t("pub01.basisTitle")} level={2} inset={inset} density="portal" locale={locale}>
        {page.basis !== null ? (
          <FactList
            items={[
              { label: t("pub01.fInstrument"), value: t("pub01.instrument", { date: date(page.basis.instrumentSignedOn, locale) }) },
              ...page.basis.coverage.map((org) => ({ label: org.shortName, value: t(`pub01.rights.${org.rights}`) })),
              { label: t("pub01.fNotCovered"), value: t("pub01.notCovered") },
            ]}
            locale={locale}
          />
        ) : (
          notOffered
        )}
      </Panel>

      <Panel title={t("pub01.partTitle")} level={2} inset={inset} density="portal" locale={locale}>
        {page.participants !== null ? (
          <ItemList
            items={page.participants.map((org) => ({ key: org.key, title: org.name, detail: t(`pub01.rights.${org.rights}`) }))}
            readOnly
            density="portal"
            label={t("pub01.partTitle")}
            locale={locale}
          />
        ) : (
          notOffered
        )}
      </Panel>
    </>
  );
}

/** NO_VERSION_AT_INSTANT: nothing was published for the instant asked. The help routes are the way on. */
function NoVersion({
  helpRoutes,
  inset,
  t,
  locale,
}: {
  helpRoutes: LoadOutcome<readonly HelpRoute[]> | null;
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
}) {
  const failure = helpRoutes?.failure ?? null;
  return (
    <>
      <EmptyState variant="not-started" title={t("pub01.emptyTitle")} level={2} density="portal" action={false} locale={locale} />
      <Panel title={t("pub01.helpTitle")} level={2} inset={inset} density="portal" locale={locale}>
        {failure !== null ? (
          <PageError failure={failure} level={3} t={t} locale={locale} />
        ) : (
          <ItemList items={(helpRoutes?.data ?? []).map((route) => helpItem(route, t, locale))} readOnly density="portal" label={t("pub01.helpTitle")} locale={locale} />
        )}
      </Panel>
    </>
  );
}

function helpItem(route: HelpRoute, t: Translate, locale: Locale) {
  const confirmed = date(route.confirmedOn, locale);
  return route.kind === "support_line"
    ? { key: route.kind, title: t("pub01.helpLine", { line: route.value }), detail: t("pub01.helpLineDetail", { date: confirmed }) }
    : {
        key: route.kind,
        title: t("pub01.helpContact", { email: route.value }),
        href: `mailto:${route.value}`,
        detail: t("pub01.helpContactDetail", { date: confirmed }),
      };
}

function Loading({ inset, t, locale }: { inset: "sm" | "md"; t: Translate; locale: Locale }) {
  return (
    <>
      <Skeleton variant="text" rows={4} density="portal" locale={locale} />
      <Panel title={t("pub01.opTitle")} level={2} inset={inset} density="portal" locale={locale}>
        <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
      </Panel>
      <Panel title={t("pub01.basisTitle")} level={2} inset={inset} density="portal" locale={locale}>
        <Skeleton variant="facts" rows={3} density="portal" locale={locale} />
      </Panel>
    </>
  );
}

function date(value: string | null, locale: Locale): string {
  return (value !== null ? R1_FORMAT.formatDate(value, locale) : null) ?? "-";
}

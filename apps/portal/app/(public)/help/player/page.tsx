import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Disclosure, EmptyState, ItemList, Link, NumberedSteps, PageHeader, Panel, Skeleton, StatusLine } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { helpItem } from "@/features/public/help-items";
import { publicLayout } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { loadPlayerGuide, type PlayerGuidePage } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { PUB13_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

/** How many steps each part of the guide has, in the catalogue (`pub13.step.<part>.<n>`). */
const STEPS: Readonly<Record<string, number>> = { enrol: 3, pair: 3, sync: 2, recover: 3 };

/**
 * SCR-PUB-13 Player installation guide (D-PUB-14): enrol, pair, synchronise and recover a RightOne Player without
 * administrative help, with the help routes of the journey PLAYER. The guide in effect is 2026.1, from 15 September
 * 2026; read as at an earlier day (`?at=`), no version existed, and a day not yet come is refused.
 */
export default async function PlayerGuidePageRoute({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the guide as in effect today, or as at the day asked.
  const view = reviewView(query, PUB13_VIEWS);
  const { narrow, gap, inset } = publicLayout(frame);
  const outcome = view === "loading" ? null : await loadPlayerGuide(one(query.at), view);
  const page = outcome?.data ?? null;
  const guide = page?.guide.data ?? null;
  const version = guide?.version ?? null;
  const guideFailure = page?.guide.failure ?? outcome?.failure ?? null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader
          title={t("pub13.title")}
          {...(version !== null
            ? {
                status: { family: "positive" as const, label: t("pub.inEffect") },
                meta: t("pub13.meta", { version: version.label, date: R1_FORMAT.formatDate(version.effectiveFrom, locale) ?? "-" }),
              }
            : {})}
          size="public"
          locale={locale}
        />

        {guideFailure?.code === "INSTANT_INVALID" && (
          <Banner family="attention" title={t("pub.instantTitle")} code={guideFailure.code} density="portal" locale={locale}>
            {t("pub.instantText")}
          </Banner>
        )}
        {guideFailure !== null && guideFailure.code !== "INSTANT_INVALID" && <PageError failure={guideFailure} t={t} locale={locale} />}

        {version !== null && (
          <Panel as="div" gap="sm" inset={inset} density="portal" locale={locale}>
            {/* 2026.1 is worded in this page's catalogue, part by part; a version written on the policy console carries its own text. */}
            {version.sections.length > 0
              ? version.sections.map((section, index) => (
                  <Disclosure key={section.id} title={section.heading[locale]} open={index === 0 || (index === 1 && !narrow)} level={2} density="portal" locale={locale}>
                    <Text as="p" size="base">
                      {section.body[locale]}
                    </Text>
                  </Disclosure>
                ))
              : version.sectionKeys.map((part, index) => (
                  // The first part is open, and on a wide screen the second too, as the board draws them.
                  <Disclosure key={part} title={t(`pub13.section.${part}`)} open={index === 0 || (index === 1 && !narrow)} level={2} density="portal" locale={locale}>
                    <NumberedSteps steps={Array.from({ length: STEPS[part] ?? 0 }, (_, step) => t(`pub13.step.${part}.${step + 1}`))} locale={locale} />
                  </Disclosure>
                ))}
          </Panel>
        )}
        {guide !== null && version === null && (
          <EmptyState variant="not-started" title={t("pub.noVersionAtInstant")} level={2} density="portal" action={false} locale={locale} />
        )}

        {view === "loading" && <Skeleton variant="text" rows={6} density="portal" locale={locale} />}

        {/* The help routes stand beside the guide and in its place when no version applies. */}
        {page !== null && guide !== null && <Routes page={page} narrow={narrow} inset={inset} t={t} locale={locale} />}

        <Link href={routes.help()} variant="standalone" size="touch" icon="circle-help" locale={locale}>
          {t("pub.help")}
        </Link>
      </div>
    </PublicShell>
  );
}

/** The routes of the journey PLAYER, or (Partial) a note that they could not be read, the guide still shown. */
function Routes({ page, narrow, inset, t, locale }: { page: PlayerGuidePage; narrow: boolean; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const items = page.routes.data;
  return (
    <Panel title={t("pub13.helpTitle")} level={2} inset={inset} density="portal" locale={locale}>
      {items !== null ? (
        <ItemList items={items.map((item) => helpItem(item, "pub13", narrow, t, locale))} readOnly density="portal" label={t("pub13.helpTitle")} locale={locale} />
      ) : (
        <StatusLine family="info" text={t("pub13.routesFailed")} locale={locale} />
      )}
    </Panel>
  );
}

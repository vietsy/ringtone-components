import type { ReactNode } from "react";
import { Banner, ItemList, Link, NavList, PageHeader, Panel, Skeleton } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { helpItem } from "@/features/public/help-items";
import { publicLayout } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { PageSections } from "@/features/public/PageSections";
import { loadHelpJourney, loadPublicPage, type HelpPurpose, type HelpRouteItem } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { PUB12_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

/** The page's two groups, in the order of purposes; the Player guide's own route is SCR-PUB-13's. */
const SUPPORT: readonly HelpPurpose[] = ["support", "complaint", "correction", "external_escalation", "authoritative"];
const PRIVACY: readonly HelpPurpose[] = ["privacy_information", "privacy_rights"];

/**
 * SCR-PUB-12 Help, privacy and contacts (D-PUB-13): the route for help, a complaint, a correction, privacy information
 * and rights, and the operator's contact, each with when it was last confirmed. A route still being confirmed, or one
 * not offered yet, shows the authoritative contact in its place and says so (P1: the complaint route and privacy
 * information). Opened for one journey (`?journey=`), it lists that journey's routes; "Quay lại" returns to the
 * verification answer or the track page it was opened from (`?from=`).
 */
export default async function HelpPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the register's routes for the journey asked, or for every one.
  const view = reviewView(query, PUB12_VIEWS);
  const { narrow, gap, inset } = publicLayout(frame);
  const outcome = view === "loading" ? null : await loadHelpJourney(one(query.journey), view);
  const items = outcome?.data ?? null;
  // The help page in effect (GET /pages/HELP) as the policy console published it, above the routes; a version whose
  // text the canvas holds in no register has nothing of its own to show here.
  const helpText = view === null ? ((await loadPublicPage("HELP")).data?.text.version?.sections ?? []) : [];
  const failure = outcome?.failure ?? null;
  const back = backTo(one(query.from));
  const privacyNotice = items?.find((item) => item.purpose === "privacy_information" && !item.replacedByAuthoritativeContact) ?? null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        {back !== null && (
          <Link href={back} back variant="standalone" size="touch" locale={locale}>
            {t("pub12.back")}
          </Link>
        )}
        <PageHeader title={t("pub12.title")} size="public" locale={locale} />

        {failure?.code === "JOURNEY_UNKNOWN" && <Banner family="neutral" title={t("pub12.journeyTitle")} code={failure.code} density="portal" locale={locale} />}
        {failure !== null && failure.code !== "JOURNEY_UNKNOWN" && <PageError failure={failure} t={t} locale={locale} />}
        {helpText.length > 0 && <PageSections sections={helpText} inset={inset} locale={locale} />}

        {items !== null && (
          <>
            <RouteGroup title={t("pub12.supportTitle")} items={items.filter((item) => SUPPORT.includes(item.purpose))} narrow={narrow} inset={inset} t={t} locale={locale} />
            <RouteGroup title={t("pub12.privacyTitle")} items={items.filter((item) => PRIVACY.includes(item.purpose))} narrow={narrow} inset={inset} t={t} locale={locale}>
              {privacyNotice !== null && (
                <Link href={routes.legalDocument("privacy-notice")} variant="standalone" size="touch" icon="file-text" locale={locale}>
                  {t("pub12.readNotice")}
                </Link>
              )}
            </RouteGroup>
          </>
        )}

        {view === "loading" && (
          <Panel title={t("pub12.supportTitle")} level={2} inset={inset} density="portal" locale={locale}>
            <Skeleton variant="table" rows={4} columns={2} density="portal" locale={locale} />
          </Panel>
        )}

        <NavList
          title={t("pub.goTitle")}
          items={[
            { label: t("pub12.verify"), detail: t("pub12.verifyD"), icon: "search", href: routes.verify() },
            { label: t("pub12.guide"), detail: t("pub12.guideD"), icon: "speaker", href: routes.playerGuide() },
            { label: t("pub12.legal"), detail: t("pub12.legalD"), icon: "file-text", href: routes.legalDocument() },
            { label: t("pub.about"), detail: t("pub12.aboutD"), icon: "info", href: routes.home() },
            { label: t("pub12.scope"), detail: t("pub12.scopeD"), icon: "circle-help", href: routes.scope() },
          ]}
          locale={locale}
        />
      </div>
    </PublicShell>
  );
}

/** A group of routes; a journey that offers none of its purposes leaves it out. */
function RouteGroup({
  title,
  items,
  narrow,
  inset,
  t,
  locale,
  children,
}: {
  title: string;
  items: readonly HelpRouteItem[];
  narrow: boolean;
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
  children?: ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <Panel title={title} level={2} inset={inset} density="portal" locale={locale}>
      <ItemList items={items.map((item) => helpItem(item, "pub12", narrow, t, locale))} readOnly density="portal" label={title} locale={locale} />
      {children}
    </Panel>
  );
}

/**
 * "Quay lại": the screen the reader came from, which the spec names as a verification answer (SCR-PUB-05, 06) or a
 * track page (SCR-PUB-09). The address carries it; anything else, or nothing, offers no way back rather than a link
 * this page cannot vouch for.
 */
function backTo(from: string | undefined) {
  if (from === undefined) return null;
  const segment = (match: RegExpExecArray | null): string | null => {
    if (match?.[1] === undefined) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  };
  const player = segment(/^\/verify\/player\/([^/?#]+)$/.exec(from));
  if (player !== null) return routes.verifyPlayer(player);
  const certificate = segment(/^\/verify\/([^/?#]+)$/.exec(from));
  if (certificate !== null) return routes.verification(certificate);
  const track = segment(/^\/t\/([^/?#]+)$/.exec(from));
  return track !== null ? routes.track(track) : null;
}

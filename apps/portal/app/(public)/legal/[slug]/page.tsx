import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  Button,
  ButtonRow,
  EmptyState,
  FactList,
  LegalTextViewer,
  Link,
  NavList,
  PageHeader,
  Panel,
  Skeleton,
  StatusLine,
  Table,
  ViewState,
} from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { publicLayout } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { LEGAL_DOCUMENTS, isLegalDocument, legalSlug, loadLegalLibrary, type LegalLibraryPage, type VersionedText, type VersionPeriod } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { PUB10_VIEWS } from "@/lib/mock/public";
import type { LegalDocumentSlug } from "@/lib/route-groups/public-pages";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);
const date = (value: string, locale: Locale): string => R1_FORMAT.formatDate(value, locale) ?? "-";

/**
 * SCR-PUB-10 Legal document library (D-PUB-10): the RightOne Player terms, the rights-withdrawal material, the takedown
 * process and the privacy notice in force, any earlier version, and the versions of the page "What RightOne is". At
 * P1 no legal document has a published version, so the library says none existed at that time; the privacy notice is
 * DAT's, which DAT does not offer yet, and its page points to the privacy contacts that stay open.
 */
export default async function LegalDocumentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the document the address names, as at `at`, with `history`.
  const view = reviewView(query, PUB10_VIEWS);
  const { narrow, gap, inset } = publicLayout(frame);
  const outcome = view === "loading" ? null : await loadLegalLibrary(slug, { at: one(query.at), history: one(query.history) }, view);
  const library = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // The document the page stands on: the one the address names, or the one a review view draws.
  const shown: LegalDocumentSlug | null = library !== null ? legalSlug(library.kind) : isLegalDocument(slug) ? slug : null;
  const text = library !== null && library.history === null ? (library.document.data ?? null) : null;
  const version = text?.version ?? null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader
          title={shown !== null && failure === null ? t(`pub10.doc.${shown}`) : t("pub10.libraryTitle")}
          {...(version !== null
            ? {
                status: version.state === "SUPERSEDED" ? { family: "neutral" as const, label: t("pub.notCurrent") } : { family: "positive" as const, label: t("pub.inEffect") },
                meta:
                  text !== null && text.asAt !== null
                    ? t("pub10.metaOld", { version: version.label, date: date(text.asAt, locale) })
                    : t("pub10.metaNow", { version: version.label, date: date(version.effectiveFrom, locale) }),
              }
            : {})}
          size="public"
          locale={locale}
        />

        {view === "loading" && <Skeleton variant="text" rows={6} density="portal" locale={locale} />}
        {failure?.code === "DOCUMENT_KIND_UNKNOWN" && (
          <ViewState view="refused" refusal={{ code: failure.code, title: t("pub10.kindTitle"), text: "", family: "neutral" }} level={2} density="portal" locale={locale} />
        )}
        {failure !== null && failure.code !== "DOCUMENT_KIND_UNKNOWN" && <PageError failure={failure} t={t} locale={locale} />}
        {library !== null && (library.history !== null ? <History library={library} narrow={narrow} inset={inset} t={t} locale={locale} /> : <Document library={library} t={t} locale={locale} />)}

        {shown !== null && (
          <ButtonRow label={t("pub10.historyGroup")}>
            <Button variant="secondary" size="md" icon="history" href={routes.legalDocument(shown, { history: "document" })} fullWidth={narrow} locale={locale}>
              {t("pub10.history")}
            </Button>
            <Button variant="quiet" size="md" icon="history" href={routes.legalDocument(shown, { history: "page" })} fullWidth={narrow} locale={locale}>
              {t("pub10.pageHistory")}
            </Button>
          </ButtonRow>
        )}

        <NavList
          title={t("pub10.docsTitle")}
          items={LEGAL_DOCUMENTS.map((document) => ({
            label: t(`pub10.doc.${document}`),
            href: routes.legalDocument(document),
            icon: "file-text",
            current: document === shown && failure === null,
          }))}
          locale={locale}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2) var(--space-6)" }}>
          <Link href={routes.home()} variant="standalone" size="touch" locale={locale}>
            {t("pub.about")}
          </Link>
          <Link href={routes.help()} variant="standalone" size="touch" locale={locale}>
            {t("pub.help")}
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}

/** The document as `GET /legal-documents/{kind}` answered: its text in a version, none at that time, or a refusal. */
function Document({ library, t, locale }: { library: LegalLibraryPage; t: Translate; locale: Locale }) {
  const { document } = library;
  if (document.failure !== null) {
    if (document.failure.code === "INSTANT_INVALID") {
      return (
        <Banner family="attention" title={t("pub.instantTitle")} code={document.failure.code} density="portal" locale={locale}>
          {t("pub.instantText")}
        </Banner>
      );
    }
    // SOURCE_UNAVAILABLE that retrying will not change: the privacy notice DAT does not offer yet.
    if (document.failure.code === "SOURCE_UNAVAILABLE" && !document.failure.retryable) {
      return (
        <>
          <ViewState view="refused" refusal={{ code: document.failure.code, title: t("pub.naTitle"), text: t("pub.naText"), family: "info" }} level={2} density="portal" locale={locale} />
          {library.kind === "PRIVACY_NOTICE" && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "var(--space-1) var(--space-2)" }}>
              <Text as="span" size="base">
                {t("pub10.privacyRoute")}
              </Text>
              <Link href={routes.help({ journey: "privacy" })} locale={locale}>
                {t("pub10.privacyLink")}
              </Link>
            </div>
          )}
        </>
      );
    }
    return <PageError failure={document.failure} t={t} locale={locale} />;
  }
  const text = document.data;
  if (text === null || text.version === null) {
    return <EmptyState variant="not-started" title={t("pub.noVersionAtInstant")} level={2} density="portal" action={false} locale={locale} />;
  }
  return <VersionText text={text} slug={legalSlug(library.kind)} t={t} locale={locale} />;
}

function VersionText({ text, slug, t, locale }: { text: VersionedText; slug: LegalDocumentSlug; t: Translate; locale: Locale }) {
  const version = text.version;
  if (version === null) return null;
  return (
    <>
      {text.upcoming !== null && (
        <StatusLine family="info" text={t("pub10.upcoming", { version: text.upcoming.label, date: date(text.upcoming.effectiveFrom, locale) })} locale={locale} />
      )}
      {text.current !== null && (
        <StatusLine family="neutral" text={t("pub.supersededBy", { version: text.current.label, date: date(text.current.effectiveFrom, locale) })} locale={locale} />
      )}
      <LegalTextViewer
        title={t(`pub10.doc.${slug}`)}
        version={version.label}
        effective={version.effectiveFrom}
        sections={version.sections.map((section) => ({ id: section.id, heading: section.heading[locale], body: section.body[locale] }))}
        locale={locale}
      />
      {version.digest !== null && <FactList items={[{ label: t("pub10.fDigest"), value: version.digest, kind: "mono" }]} locale={locale} />}
    </>
  );
}

/** "Xem lịch sử" or "Lịch sử trang chính sách": the published versions, newest first, each with its state and period. */
function History({ library, narrow, inset, t, locale }: { library: LegalLibraryPage; narrow: boolean; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const history = library.history;
  if (history === null) return null;
  const title = t(history.of === "page" ? "pub10.pageHistTitle" : "pub10.histTitle");
  const failure = history.versions.failure;
  return (
    <Panel title={title} level={2} inset={inset} density="portal" locale={locale}>
      {failure !== null ? (
        failure.code === "SOURCE_UNAVAILABLE" && !failure.retryable ? (
          <StatusLine family="neutral" text={t("pub.naTitle")} detail={t("pub.naText")} locale={locale} />
        ) : (
          <PageError failure={failure} level={3} t={t} locale={locale} />
        )
      ) : (
        <Table
          columns={[
            { key: "v", label: t("pub10.cVersion"), kind: "link" },
            { key: "state", label: t("pub10.cState"), kind: "status" },
            { key: "period", label: t("pub10.cPeriod") },
          ]}
          rows={(history.versions.data ?? []).map((row) => ({
            _key: row.label,
            v: { label: row.label, ...readable(row, history.of, legalSlug(library.kind)) },
            state: stateOf(row, t, locale),
            period: periodOf(row, t, locale),
          }))}
          layout={narrow ? "cards" : "table"}
          density="portal"
          caption={title}
          empty={{ variant: "not-started", title: t("pub10.noVersions"), action: false }}
          locale={locale}
        />
      )}
    </Panel>
  );
}

/**
 * Where a listed version is read: a legal document as at the instant it took effect; "What RightOne is" in effect on the
 * home page, and an earlier version on the home page as at the instant it took effect (SCR-PUB-01's `at`), marked
 * superseded there. An upcoming version is not read before it takes effect.
 */
function readable(row: VersionPeriod, of: "document" | "page", slug: LegalDocumentSlug): { href?: string } {
  if (row.state === "UPCOMING") return {};
  if (of === "page") return { href: row.state === "IN_EFFECT" ? routes.home() : routes.about({ at: row.effectiveFrom }) };
  return { href: routes.legalDocument(slug, { at: row.effectiveFrom }) };
}

function stateOf(row: VersionPeriod, t: Translate, locale: Locale) {
  if (row.state === "UPCOMING") return { family: "info" as const, label: t("pub.upcomingOn", { date: date(row.effectiveFrom, locale) }) };
  return row.state === "IN_EFFECT" ? { family: "positive" as const, label: t("pub.inEffect") } : { family: "neutral" as const, label: t("pub.notCurrent") };
}

function periodOf(row: VersionPeriod, t: Translate, locale: Locale): string {
  if (row.state === "UPCOMING") return t("pub10.openEnded");
  if (row.effectiveTo === null) return t("pub10.from", { date: date(row.effectiveFrom, locale) });
  return R1_FORMAT.formatPeriod(row.effectiveFrom, row.effectiveTo, locale) ?? "-";
}

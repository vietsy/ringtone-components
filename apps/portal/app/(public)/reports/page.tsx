import { R1_FORMAT } from "@rightone/formatting";
import type { LoadOutcome } from "@rightone/ui";
import { Banner, Button, DateField, FactList, ItemList, NavList, PageHeader, Panel, Skeleton, StatusLine } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { publicLayout } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { PageSections } from "@/features/public/PageSections";
import { loadDisclosures, loadPublicPage, type AmnestyDisclosure, type DisclosuresPage, type PublicTariff, type ReportDisclosure, type ReportKind } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { PUB11_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);
const date = (value: string, locale: Locale): string => R1_FORMAT.formatDate(value, locale) ?? "-";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Parts joined into one line, its first letter a capital: "Khu vực 1: 1,2; khu vực 2: 1,0". */
const line = (parts: readonly string[], locale: Locale): string => {
  const joined = parts.join("; ");
  return joined.charAt(0).toLocaleUpperCase(locale) + joined.slice(1);
};

/** The address each disclosure is opened at by "Mở", and its name in the list. */
const REPORT_NAMES: Readonly<Record<ReportKind, string>> = {
  AUDITED_FINANCIAL_REPORT: "audited-financial-report",
  PILOT_REPORT: "pilot-report",
  TARIFF_PUBLICATION: "tariff-publication",
  MANDATE_LIST: "mandate-list",
  COST_POSITION: "cost-position",
};

/**
 * SCR-PUB-11 Tariff and public disclosures (D-PUB-11): the tariff in force, the amnesty period, the audited financial
 * report, the pilot report and the cost position, each as its owner released it, read as at today or as at a past
 * date ("Xem tại ngày"). Each section is its owner's answer, so one that cannot answer leaves the others shown. At P1
 * neither TAR nor REP nor FIN offers a public reader, and the amnesty is approved but not released before it begins.
 */
export default async function DisclosuresRoute({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise each owner's answer as at today or the day asked.
  const view = reviewView(query, PUB11_VIEWS);
  const { narrow, gap, inset } = publicLayout(frame);
  const outcome = view === "loading" ? null : await loadDisclosures({ at: one(query.at), open: one(query.open) }, view);
  const page = outcome?.data ?? null;
  // The page "Cách đọc biểu phí" (GET /pages/TARIFF) as the policy console published it, as at the same day; a version
  // whose text the canvas holds in no register has nothing of its own to show here.
  const howTo = view === null && page !== null ? ((await loadPublicPage("TARIFF", page.asAt ?? undefined)).data?.text.version?.sections ?? []) : [];
  const failure = outcome?.failure ?? null;
  // The day in the field: the one refused, as typed when it is a day, or the one the page is read as at.
  const typed = page?.instantRefused ?? page?.asAt ?? null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader
          title={t("pub11.title")}
          {...(page !== null
            ? { meta: page.asAt !== null ? t("pub11.metaAt", { date: date(page.asAt, locale) }) : t("pub11.metaNow", { at: R1_FORMAT.formatTimestamp(page.servedAt, locale) ?? "-" }) }
            : {})}
          size="public"
          locale={locale}
        />

        {page !== null && page.unknownDisclosure !== null && <Banner family="neutral" title={t("pub11.kindTitle")} code="DISCLOSURE_KIND_UNKNOWN" density="portal" locale={locale} />}

        <form action={routes.disclosures()}>
          <Panel as="div" inset={inset} gap="md" density="portal" locale={locale}>
            <DateField
              label={t("pub11.atLabel")}
              name="at"
              {...(typed !== null && ISO_DATE.test(typed) ? { value: typed } : {})}
              helper={t("pub11.atHelp")}
              {...(page !== null && page.instantRefused !== null ? { error: `${t("pub.instantTitle")} ${t("pub.instantText")}` } : {})}
              density="portal"
              locale={locale}
            />
            <div>
              <Button variant="secondary" size="md" icon="calendar" type="submit" fullWidth={narrow} locale={locale}>
                {t("pub11.atButton")}
              </Button>
            </div>
          </Panel>
        </form>

        {howTo.length > 0 && <PageSections sections={howTo} inset={inset} locale={locale} />}
        {page !== null && <Sections page={page} inset={inset} t={t} locale={locale} />}
        {failure !== null && <PageError failure={failure} t={t} locale={locale} />}
        {view === "loading" && (
          <>
            <Panel title={t("pub11.tariffTitle")} level={2} inset={inset} density="portal" locale={locale}>
              <Skeleton variant="facts" rows={4} density="portal" locale={locale} />
            </Panel>
            <Panel title={t("pub11.amnestyTitle")} level={2} inset={inset} density="portal" locale={locale}>
              <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
            </Panel>
            <Panel title={t("pub11.reportsTitle")} level={2} inset={inset} density="portal" locale={locale}>
              <Skeleton variant="table" rows={4} columns={2} density="portal" locale={locale} />
            </Panel>
          </>
        )}

        <NavList
          title={t("pub.goTitle")}
          items={[
            { label: t("pub11.estimate"), detail: t("pub11.estimateD"), icon: "banknote", href: routes.indicativeAmount() },
            { label: t("pub11.scope"), detail: t("pub11.scopeD"), icon: "circle-help", href: routes.scope() },
            { label: t("pub.about"), detail: t("pub11.aboutD"), icon: "info", href: routes.home() },
          ]}
          locale={locale}
        />
      </div>
    </PublicShell>
  );
}

function Sections({ page, inset, t, locale }: { page: DisclosuresPage; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const tariff = page.tariff.data;
  const amnesty = page.amnesty.data;
  const noneOffered = page.reports.every((report) => isNotOffered(report.answer));
  return (
    <>
      <Panel
        title={t("pub11.tariffTitle")}
        {...(tariff !== null && tariff.state !== "NO_APPROVED_TARIFF"
          ? { status: tariff.state === "SUPERSEDED" ? { family: "neutral" as const, label: t("pub.notCurrent") } : { family: "positive" as const, label: t("pub.inEffect") } }
          : {})}
        level={2}
        gap="md"
        inset={inset}
        density="portal"
        locale={locale}
      >
        {tariff !== null ? <Tariff tariff={tariff} t={t} locale={locale} /> : <SectionUnanswered outcome={page.tariff} t={t} locale={locale} />}
      </Panel>

      <Panel
        title={t("pub11.amnestyTitle")}
        {...(amnesty !== null
          ? { status: amnesty.state === "RELEASED" ? { family: "positive" as const, label: t("pub11.released") } : { family: "neutral" as const, label: t("pub11.notReleased") } }
          : {})}
        level={2}
        gap="md"
        inset={inset}
        density="portal"
        locale={locale}
      >
        {amnesty !== null ? <Amnesty amnesty={amnesty} t={t} locale={locale} /> : <SectionUnanswered outcome={page.amnesty} t={t} locale={locale} />}
      </Panel>

      <Panel title={t("pub11.reportsTitle")} {...(noneOffered ? { description: t("pub.naText") } : {})} level={2} inset={inset} density="portal" locale={locale}>
        <ItemList items={page.reports.map((report) => reportItem(report.kind, report.answer, page.asAt, t, locale))} readOnly density="portal" label={t("pub11.reportsTitle")} locale={locale} />
      </Panel>
    </>
  );
}

const isNotOffered = (outcome: LoadOutcome<unknown>): boolean => outcome.failure?.code === "SOURCE_UNAVAILABLE" && !outcome.failure.retryable;

/** A section its owner did not answer: not offered yet, or could not be read now (Partial), the other sections shown. */
function SectionUnanswered({ outcome, t, locale }: { outcome: LoadOutcome<unknown>; t: Translate; locale: Locale }) {
  if (outcome.failure === null) return null;
  return isNotOffered(outcome) ? (
    <StatusLine family="neutral" text={t("pub.naTitle")} detail={t("pub.naText")} locale={locale} />
  ) : (
    <StatusLine family="neutral" text={t("pub.unTitle")} detail={t("pub.unText")} locale={locale} />
  );
}

function Tariff({ tariff, t, locale }: { tariff: PublicTariff; t: Translate; locale: Locale }) {
  if (tariff.state === "NO_APPROVED_TARIFF") return <StatusLine family="neutral" text={t("pub11.noTariff")} locale={locale} />;
  return (
    <>
      {tariff.current !== null && (
        <StatusLine family="neutral" text={t("pub.supersededBy", { version: tariff.current.version, date: date(tariff.current.effectiveFrom, locale) })} locale={locale} />
      )}
      <FactList
        items={[
          { label: t("pub11.fVersion"), value: tariff.version },
          { label: t("pub11.fInstrument"), value: t("pub11.instrument", { number: tariff.instrumentNumber }) },
          tariff.effectiveTo !== null
            ? { label: t("pub11.fFrom"), value: { from: tariff.effectiveFrom, to: tariff.effectiveTo }, kind: "period" as const }
            : { label: t("pub11.fFrom"), value: t("pub11.from", { date: date(tariff.effectiveFrom, locale) }) },
          { label: t("pub11.fComponents"), value: line(tariff.components.map((right) => t(`pub11.right.${right}`)), locale) },
          {
            label: t("pub11.fFactors"),
            value: line(
              tariff.localityFactorsHundredths.map((factor, index) => t("pub11.factor", { class: index + 1, factor: R1_FORMAT.percentDigits(factor / 100, locale, 1) })),
              locale,
            ),
          },
          { label: t("pub11.fCap"), value: tariff.capMinor, kind: "money" as const },
          { label: t("pub11.fRound"), value: t("pub11.round", { unit: R1_FORMAT.formatMoney(tariff.roundingUnitMinor, "VND", locale) ?? "-" }) },
          { label: t("pub11.fExempt"), value: t("pub11.exempt", { floor: tariff.exemptionFloorAtMostM2 }) },
          { label: t("pub.fAnswered"), value: tariff.sourceAnsweredAt, kind: "datetime" as const },
        ]}
        locale={locale}
      />
    </>
  );
}

function Amnesty({ amnesty, t, locale }: { amnesty: AmnestyDisclosure; t: Translate; locale: Locale }) {
  // Not released before it begins, but announced once approved; asked as at a day before its approval, nothing is known.
  if (amnesty.state === "NOT_RELEASED" && amnesty.approvedAt === null) return null;
  return (
    <>
      {amnesty.state === "NOT_RELEASED" && <StatusLine family="info" text={t("pub.upcomingOn", { date: date(amnesty.period.from, locale) })} locale={locale} />}
      <FactList
        items={[
          { label: t("pub11.fPeriod"), value: amnesty.period, kind: "period" },
          { label: t("pub11.fVersion"), value: amnesty.version },
          ...(amnesty.approvedAt !== null ? [{ label: t("pub11.fApproved"), value: amnesty.approvedAt, kind: "datetime" as const }] : []),
          { label: t("pub.fAnswered"), value: amnesty.sourceAnsweredAt, kind: "datetime" },
        ]}
        locale={locale}
      />
    </>
  );
}

function reportItem(kind: ReportKind, answer: LoadOutcome<ReportDisclosure>, asAt: string | null, t: Translate, locale: Locale) {
  const report = answer.data;
  const title = report !== null && report.year !== null ? t("pub11.report.AUDITED_FINANCIAL_REPORT_YEAR", { year: report.year }) : t(`pub11.report.${kind}`);
  if (report === null) return { key: kind, title, detail: isNotOffered(answer) ? t("pub.naTitle") : t("pub.unTitle") };
  if (report.state === "NOT_RELEASED" || report.releasedOn === null) return { key: kind, title, detail: t("pub11.notReleased") };
  const detail =
    report.cost !== null
      ? t("pub11.costLine", {
          end: date(report.cost.periodEnd, locale),
          ratio: R1_FORMAT.formatPercent(report.cost.ratioPercent, locale) ?? "-",
          ceiling: R1_FORMAT.formatPercent(report.cost.ceilingPercent, locale) ?? "-",
          approved: date(report.cost.approvedOn, locale),
        })
      : t("pub11.releasedOn", { date: date(report.releasedOn, locale) });
  return { key: kind, title, detail, href: routes.disclosures({ open: REPORT_NAMES[kind], ...(asAt !== null ? { at: asAt } : {}) }) };
}

import { Banner, Button, ButtonRow, Link, PageHeader, Table, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { ApplyForm } from "@/features/player-ops/ApplyForm";
import { day, plropsTranslator, refusalWords } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { SegmentLinks } from "@/features/player-ops/LinkFilter";
import { registerColumns, registerRow, registerSegments } from "@/features/player-ops/register";
import { readForPage } from "@/lib/api/flash";
import { loadCertificationRegister, type ApplyAttempt, type CertificationRegisterView } from "@/lib/api/player";
import { currentWorld } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR10_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-10 Certification register, public: every application against the published device-assurance criteria, a
 * refused one kept with the criterion it did not meet, because BR-PLR-24 requires equal terms for any supplier and a
 * register nobody outside can read is not equal terms. Any supplier applies here, with no account.
 */
export default async function CertificationRegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const [locale, frame, world] = await Promise.all([getLocale(), getFrame(query), currentWorld()]);
  const t = plropsTranslator(locale);
  const phone = frame === "phone";
  const view = reviewView(query, PLR10_VIEWS);
  const attempt = readForPage<ApplyAttempt>(query);
  const mine = attempt?.page === "apply" ? attempt : null;
  const show = typeof query.show === "string" ? query.show : null;
  const outcome = view === "loading" ? null : await loadCertificationRegister(world, show, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          eyebrow={t("plr10.eyebrow")}
          title={t("plr10.title")}
          {...(data !== null && data.updatedOn !== null ? { meta: t("plr10.meta", { d: day(data.updatedOn, locale) }) } : {})}
          size="public"
          locale={locale}
        />
        <Text size="lg">{t("plr10.lead")}</Text>
        {mine !== null && mine.lodged !== null ? (
          <Banner family="positive" title={t("plr10.done", { s: mine.values.applicant, v: mine.values.version })} compact density="portal" locale={locale} />
        ) : null}
        {view === "loading" ? <ViewState view="loading" skeleton="table" rows={7} density="portal" locale={locale} /> : null}
        {failure !== null ? <Failure failure={failure} errorText={t("plr10.errText")} prefix="plrops" density="portal" t={t} locale={locale} /> : null}
        {data !== null ? <Register data={data} phone={phone} t={t} locale={locale} /> : null}
        {data !== null ? (
          <Actions data={data} attempt={mine} visit={typeof query.attempt === "string" ? query.attempt : ""} phone={phone} t={t} locale={locale} />
        ) : null}
        <Link href={routes.assurancePolicy()} variant="standalone" size="touch" locale={locale}>
          {t("plr10.policy")}
        </Link>
      </div>
    </PublicShell>
  );
}

function Register({ data, phone, t, locale }: { data: CertificationRegisterView; phone: boolean; t: Translate; locale: Locale }) {
  if (data.counts.all === 0) {
    return <ViewState view="empty" empty={{ variant: "not-started", title: t("plr10.emptyTitle"), text: t("plr10.emptyText") }} density="portal" level={2} locale={locale} />;
  }
  const validity = Object.fromEntries(data.versions.map((version) => [version.no, version.validityMonths]));
  return (
    <>
      <SegmentLinks label={t("plr10.show")} options={registerSegments(data, (filter) => routes.certificationRegister(filter === "all" ? undefined : filter), t)} value={data.filter} density="portal" locale={locale} />
      <Table
        columns={registerColumns(t)}
        rows={data.rows.map((row) => registerRow(row, validity, t, locale))}
        layout={phone ? "cards" : "table"}
        density="portal"
        caption={t("plr10.title")}
        sortNote={t("plr10.sortNote")}
        empty={{ variant: "filtered", title: t("plr10.filteredTitle"), text: t("plr10.filteredText"), action: false }}
        locale={locale}
      />
    </>
  );
}

function Actions({ data, attempt, visit, phone, t, locale }: { data: CertificationRegisterView; attempt: ApplyAttempt | null; visit: string; phone: boolean; t: Translate; locale: Locale }) {
  const refused = attempt !== null && attempt.lodged === null ? attempt : null;
  const apply = (
    <ApplyForm
      // Each answer opens the register afresh: the dialogue reopens only for a refusal.
      key={visit}
      versions={[...data.versions]
        .sort((a, b) => Number(b.inEffect) - Number(a.inEffect) || b.no - a.no)
        .map((version) => ({ value: String(version.no), label: t(version.inEffect ? "plr10.versionInEffect" : "plr10.version", { n: version.no }) }))}
      initial={refused?.values ?? null}
      refusal={refused !== null && refused.code !== null ? { code: refused.code, ...refusalWords(refused.code, t, "plrops") } : null}
      nameError={refused?.field === "applicant" ? t("plr10.applicantMissing") : null}
      fullWidth={phone}
      words={{
        apply: t("plr10.apply"),
        title: t("plr10.dlgTitle"),
        text: t("plr10.dlgText"),
        applicant: t("plr10.applicant"),
        applicantHelp: t("plr10.applicantHelp"),
        version: t("plr10.criteriaVersion"),
        chooseVersion: t("plr10.chooseVersion"),
        submit: t("plr10.submit"),
        cancel: t("plr10.cancel"),
      }}
      locale={locale}
    />
  );
  const close = (
    <Button variant="quiet" size="md" href={routes.home()} fullWidth={phone} locale={locale}>
      {t("plrops.close")}
    </Button>
  );
  return phone ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {apply}
      {close}
    </div>
  ) : (
    <ButtonRow>
      {apply}
      {close}
    </ButtonRow>
  );
}

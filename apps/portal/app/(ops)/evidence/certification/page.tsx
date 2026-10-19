import { Banner, Button, PageHeader, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { AssessRegister } from "@/features/player-ops/AssessRegister";
import { day, plropsTranslator, refusalWords } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { SegmentLinks } from "@/features/player-ops/LinkFilter";
import { registerColumns, registerRow, registerSegments } from "@/features/player-ops/register";
import { readForPage } from "@/lib/api/flash";
import { loadCertificationRegister, type AssessAttempt, type CertificationRegisterView } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR10_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-10 Certification register on the evidence console: the register the public reads, worked by the evidence
 * owner, who records each outcome against the criteria version the application was lodged under. A supplier
 * certified, its devices paired with their premises become active (DR-215).
 */
export default async function EvidenceCertificationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-EVD");
  const query = await searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(query, PLR10_VIEWS);
  const attempt = readForPage<AssessAttempt>(query);
  const mine = attempt?.page === "assess" ? attempt : null;
  const show = typeof query.show === "string" ? query.show : null;
  // The console reads the register in the signed-in member's world, the one the public page of this browser reads.
  const outcome = view === "loading" ? null : await loadCertificationRegister(staff.sessionId, show, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const decided = mine !== null && mine.done !== null ? mine : null;
  const supplier = mine === null ? "" : (data?.rows.find((row) => row.id === mine.certification)?.supplier ?? "");

  return (
    <OpsFrame console="evidence" current="certification" staff={staff} searchLabel={t("plrops.evSearch")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.evArea") }, { label: t("plr10.title") }]}
          title={t("plr10.title")}
          {...(data !== null && data.updatedOn !== null ? { meta: t("plr10.meta", { d: day(data.updatedOn, locale) }) } : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("plrops.close")}
          </Button>
        </PageHeader>
        {decided !== null ? (
          <Banner family="positive" title={t(decided.done === "CERTIFIED" ? "plr10.aDoneCertified" : "plr10.aDoneRefused", { s: supplier, c: decided.values.criterion })} compact density="console" locale={locale} />
        ) : null}
        {view === "loading" ? <ViewState view="loading" skeleton="table" rows={7} density="console" locale={locale} /> : null}
        {failure !== null ? <Failure failure={failure} errorText={t("plr10.errText")} prefix="plrops" t={t} locale={locale} /> : null}
        {data !== null ? <Register data={data} attempt={mine !== null && mine.done === null ? mine : null} visit={typeof query.attempt === "string" ? query.attempt : ""} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Register({ data, attempt, visit, t, locale }: { data: CertificationRegisterView; attempt: AssessAttempt | null; visit: string; t: Translate; locale: Locale }) {
  if (data.counts.all === 0) {
    return <ViewState view="empty" empty={{ variant: "not-started", title: t("plr10.emptyTitle"), text: t("plr10.emptyText") }} density="console" level={2} locale={locale} />;
  }
  const validity = Object.fromEntries(data.versions.map((version) => [version.no, version.validityMonths]));
  const waiting = Object.fromEntries(
    data.rows
      .filter((row) => row.status === "APPLIED" || row.status === "UNDER_REVIEW")
      .map((row) => [row.id, { supplier: row.supplier, version: t("plr10.version", { n: row.version }), lodged: row.lodgedOn }]),
  );
  return (
    <>
      <SegmentLinks label={t("plr10.show")} options={registerSegments(data, (filter) => routes.evidenceCertification(filter === "all" ? undefined : filter), t)} value={data.filter} density="console" locale={locale} />
      <AssessRegister
        // Each answer opens the register afresh: no dialogue of the act before stays open.
        key={visit}
        columns={registerColumns(t)}
        rows={data.rows.map((row) => registerRow(row, validity, t, locale))}
        waiting={waiting}
        criteria={data.criteria}
        reopen={
          attempt === null
            ? null
            : {
                id: attempt.certification,
                values: attempt.values,
                refusal: attempt.code !== null ? { code: attempt.code, ...refusalWords(attempt.code, t, "plrops") } : null,
                outcomeError: attempt.field === "outcome" ? t("plr10.outcomeMissing") : null,
              }
        }
        caption={t("plr10.title")}
        sortNote={t("plr10.sortNote")}
        words={{
          action: t("plr10.assess"),
          title: t("plr10.aTitle"),
          text: t("plr10.aText"),
          fSupplier: t("plr10.cSupplier"),
          fVersion: t("plr10.cCriteria"),
          fLodged: t("plr10.fLodged"),
          outcome: t("plr10.cOutcome"),
          certified: t("plr10.oCertified"),
          refused: t("plr10.oRefused"),
          criterion: t("plr10.criterion"),
          chooseCriterion: t("plr10.chooseCriterion"),
          criterionOption: t("plr10.criterionOption"),
          submit: t("plr10.aSubmit"),
          keep: t("plr10.cancel"),
        }}
        locale={locale}
      />
    </>
  );
}

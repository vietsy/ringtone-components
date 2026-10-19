import { ApprovalPair, Banner, Button, ButtonRow, Checkbox, DateField, Divider, FactList, PageHeader, Panel, TextField, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { day, plropsTranslator, said } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { approveAssurancePolicy, draftAssurancePolicy } from "@/features/player-ops/actions";
import { ShortcutButton } from "@/features/player-ops/ShortcutButton";
import { readForPage } from "@/lib/api/flash";
import { loadAssuranceConsole, type ApproveAttempt, type AssuranceAttempt, type AssuranceConsoleView, type AssuranceInput, type AssuranceRecord } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR11_CONSOLE_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-11 on the evidence console: the device-assurance policy as the evidence operator keeps it. A version is
 * drafted with the four parts FR-PLR-043 names - its criteria, its issuing authority, its validity and its withdrawal
 * grounds - and the day it takes effect, then approved, published or kept unpublished. The specification lists
 * POST /assurance-policy-versions for SCR-PLR-11 and draws no control for it nor for its approval, and the public page
 * takes no act, so both sit here; the public page reads what is published.
 */
export default async function AssuranceConsolePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-EVD");
  const query = await searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(query, PLR11_CONSOLE_VIEWS);
  const attempt = readForPage<AssuranceAttempt | ApproveAttempt>(query);
  const mine = attempt?.page === "assurance" ? attempt : null;
  const approval = attempt?.page === "approve" && attempt.policy === "assurance" ? attempt : null;
  const outcome = view === "loading" ? null : await loadAssuranceConsole(staff, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const effective = data?.versions.find((version) => version.inEffect && version.published) ?? null;

  return (
    <OpsFrame console="evidence" current="assurancePolicy" staff={staff} searchLabel={t("plrops.evSearch")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.evArea") }, { label: t("plr13.crumb") }, { label: t("plr11.title") }]}
          title={t("plr11.title")}
          {...(data !== null
            ? {
                status: effective !== null ? { family: "positive" as const, label: t("plr11c.effective", { n: effective.no }) } : { family: "attention" as const, label: t("plr11c.none") },
                meta: t("plr11c.meta"),
              }
            : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" href={routes.assurancePolicy()} locale={locale}>
            {t("plr11c.public")}
          </Button>
        </PageHeader>
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={6} density="console" locale={locale} /> : null}
        {failure !== null ? <Failure failure={failure} errorText={t("plr11c.errText")} prefix="plrops" t={t} locale={locale} /> : null}
        {mine !== null && mine.saved !== null ? (
          <Banner family="positive" title={t("plr11c.saved", { n: mine.saved })} compact density="console" locale={locale}>
            {t("plr11c.savedText")}
          </Banner>
        ) : null}
        {approval !== null && approval.done ? (
          <Banner family="positive" title={t(approval.values.publish ? "plr11c.approvedPublished" : "plr11c.approvedKept", { n: approval.no })} compact density="console" locale={locale} />
        ) : null}
        {data !== null ? <Versions data={data} attempt={mine} approval={approval !== null && !approval.done ? approval : null} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Versions({ data, attempt, approval, t, locale }: { data: AssuranceConsoleView; attempt: AssuranceAttempt | null; approval: ApproveAttempt | null; t: Translate; locale: Locale }) {
  const refused = attempt !== null && attempt.saved === null ? attempt : null;
  const values: AssuranceInput = refused?.values ?? { criteria: "", authority: "", validityMonths: "", withdrawal: "", effectiveFrom: "" };
  const part = refused?.part ?? null;
  const error = (which: typeof part) => (part === which ? { error: t(`plr11c.need.${which ?? "criteria"}`) } : {});

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "flex-start" }}>
      <div style={{ flex: "3 1 var(--container-md)", minWidth: 0, maxWidth: "var(--container-3xl)" }}>
        {/* The API, not the browser, says which part is missing (POLICY_VERSION_INCOMPLETE names it). */}
        <form action={draftAssurancePolicy} noValidate style={{ display: "contents" }}>
          <Panel title={t("plr11c.formTitle", { n: data.nextNo })} description={t("plr11c.formHelp")} level={2} gap="xl" density="console" locale={locale}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <TextField label={t("plr11.fCriteria")} name="criteria" value={values.criteria} multiline rows={4} required {...error("criteria")} density="console" locale={locale} />
              <TextField label={t("plr11.fAuthority")} name="issuing_authority" value={values.authority} required {...error("authority")} density="console" locale={locale} />
              <TextField
                label={t("plr11.fValidity")}
                name="validity_period_months"
                value={values.validityMonths}
                suffix={t("plr11c.months")}
                inputMode="numeric"
                width="var(--space-40)"
                required
                {...error("validity")}
                density="console"
                locale={locale}
              />
              <TextField label={t("plr11.fWithdrawal")} name="withdrawal_grounds" value={values.withdrawal} multiline rows={3} required {...error("withdrawal")} density="console" locale={locale} />
              <DateField
                label={t("plr13.from")}
                name="effective_from"
                value={values.effectiveFrom}
                min={data.today}
                today={data.today}
                width="var(--space-60)"
                required
                helper={t("plr13.fromHelp")}
                {...error("from")}
                density="console"
                locale={locale}
              />
            </div>
            <Divider />
            {refused?.code === "POLICY_VERSION_INCOMPLETE" && part !== null && part !== "from" ? (
              <Banner family="neutral" title={t("plr13.refTitle", { part: t(`plr11c.part.${part}`) })} code="POLICY_VERSION_INCOMPLETE" density="console" locale={locale}>
                {t("plrops.refusal.POLICY_VERSION_INCOMPLETE")}
              </Banner>
            ) : null}
            <ButtonRow>
              <ShortcutButton variant="primary" size="sm" type="submit" shortcut="Alt+S" locale={locale}>
                {t("plr13.draft")}
              </ShortcutButton>
              <Button variant="quiet" size="sm" href={routes.evidenceAssurancePolicy()} locale={locale}>
                {t("plr13.cancel")}
              </Button>
            </ButtonRow>
          </Panel>
        </form>
      </div>
      <div style={{ flex: "2 1 var(--container-xs)", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {data.versions.map((version) => (
          <Version key={version.no} version={version} approval={approval?.no === version.no ? approval : null} t={t} locale={locale} />
        ))}
      </div>
    </div>
  );
}

/** Where a version stands: a draft, approved and published, approved and kept unpublished; in effect or not. */
function standing(version: AssuranceRecord, t: Translate) {
  if (version.status === "DRAFT") return { family: "info" as const, label: t("plr11c.state.DRAFT") };
  if (!version.published) return { family: "attention" as const, label: t("plr11c.state.UNPUBLISHED") };
  return version.inEffect ? { family: "positive" as const, label: t("plr11.effective") } : { family: "neutral" as const, label: t("plr11c.state.PUBLISHED") };
}

function Version({ version, approval, t, locale }: { version: AssuranceRecord; approval: ApproveAttempt | null; t: Translate; locale: Locale }) {
  const period = version.effectiveTo === null ? t("plr11c.from", { e: day(version.effectiveFrom, locale) }) : t("plr11c.between", { e: day(version.effectiveFrom, locale), to: day(version.effectiveTo, locale) });
  const acts = version.status === "DRAFT" || !version.published;
  return (
    <Panel title={t("plr11c.versionTitle", { n: version.no })} level={2} density="console" locale={locale}>
      <FactList
        items={[
          { label: t("plr11c.fState"), value: standing(version, t), kind: "status" },
          { label: t("plr11c.fPeriod"), value: period },
          { label: t("plr11.fValidity"), value: t("plr11.validity", { m: version.validityMonths }) },
          { label: t("plr11.fAuthority"), value: said(version.authority, locale) },
          { label: t("plr11c.fPublished"), value: version.publishedOn, kind: "date", missing: version.published ? t("plr11c.publishedUndated") : t("plr11c.notPublished") },
        ]}
        density="console"
        locale={locale}
      />
      {version.preparedBy !== null ? (
        <ApprovalPair
          preparer={{ name: version.preparedBy, role: t("plr13.preparerRole"), ...(version.preparedAt !== null ? { at: version.preparedAt } : {}) }}
          approver={version.approvedBy === null ? null : { name: version.approvedBy, role: t("plr13.preparerRole"), ...(version.approvedAt !== null ? { at: version.approvedAt } : {}) }}
          {...(version.approvedBy !== null ? { decision: "approved" as const } : {})}
          locale={locale}
        />
      ) : null}
      {acts ? (
        <form action={approveAssurancePolicy.bind(null, version.no)} style={{ display: "contents" }}>
          {version.status === "DRAFT" ? (
            <Checkbox label={t("plr11c.publish")} helper={t("plr11c.publishHelp")} name="publish" value="true" checked={approval?.values.publish ?? true} density="console" locale={locale} />
          ) : (
            <input type="hidden" name="publish" value="true" />
          )}
          {approval !== null && approval.code !== null ? (
            <Banner
              family="neutral"
              title={
                approval.code === "POLICY_VERSION_INCOMPLETE" && approval.part !== null
                  ? t("plr13.refTitle", { part: t(`plr11c.part.${approval.part}`) })
                  : approval.code === "EFFECTIVE_PERIOD_OVERLAPS" && approval.overlaps !== null
                    ? t("plr13.overlapTitle", { n: approval.overlaps })
                    : t("plr13.notApproved", { n: approval.no })
              }
              code={approval.code}
              density="console"
              locale={locale}
            >
              {t(`plrops.refusal.${approval.code}`)}
            </Banner>
          ) : null}
          <ButtonRow>
            <Button variant="primary" size="sm" type="submit" locale={locale}>
              {version.status === "DRAFT" ? t("plr13.approve", { n: version.no }) : t("plr11c.publishNow", { n: version.no })}
            </Button>
          </ButtonRow>
        </form>
      ) : (
        <ButtonRow>
          <Button variant="quiet" size="sm" href={routes.assurancePolicy(version.no)} locale={locale}>
            {t("plr11.read", { n: version.no })}
          </Button>
        </ButtonRow>
      )}
    </Panel>
  );
}

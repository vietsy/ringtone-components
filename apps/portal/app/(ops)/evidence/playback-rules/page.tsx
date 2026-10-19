import { ApprovalPair, Banner, Button, ButtonRow, DateField, Divider, FactList, PageHeader, Panel, TextField, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { day, plropsTranslator, said } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { approveRuleSet, draftRuleSet } from "@/features/player-ops/actions";
import { ShortcutButton } from "@/features/player-ops/ShortcutButton";
import { readForPage } from "@/lib/api/flash";
import { loadRuleSets, type ApproveAttempt, type RuleSetAttempt, type RuleSetInput, type RuleSetVersion, type RuleSetView } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR15_RULES_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The loudness and transition rule set SCR-PLR-15 names beside each day's decisions (FR-PLR-022, FR-PLR-045): its
 * versions, each with its rules and effective period, a draft of the next and Approve on a draft. The specification
 * gives the two endpoints no screen; this one opens from SCR-PLR-15's rules panel. One set applies to every premises.
 */
export default async function PlaybackRulesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-EVD");
  const query = await searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(query, PLR15_RULES_VIEWS);
  const attempt = readForPage<RuleSetAttempt | ApproveAttempt>(query);
  const mine = attempt?.page === "rules" ? attempt : null;
  const approval = attempt?.page === "approve" && attempt.policy === "rules" ? attempt : null;
  const outcome = view === "loading" ? null : await loadRuleSets(staff, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const effective = data?.versions.find((version) => version.inEffect) ?? null;

  return (
    <OpsFrame console="evidence" current="decisions" staff={staff} searchLabel={t("plrops.evSearch")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.evArea") }, { label: t("plr15.crumb"), href: routes.evidenceDecisions() }, { label: t("plr15r.title") }]}
          title={t("plr15r.title")}
          {...(data !== null
            ? {
                status: effective !== null ? { family: "positive" as const, label: t("plr15r.effective", { n: effective.no }) } : { family: "attention" as const, label: t("plr15r.none") },
                meta: t("plr15r.meta"),
              }
            : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" href={routes.evidenceDecisions()} locale={locale}>
            {t("plrops.close")}
          </Button>
        </PageHeader>
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={6} density="console" locale={locale} /> : null}
        {failure !== null ? <Failure failure={failure} errorText={t("plr15r.errText")} prefix="plrops" t={t} locale={locale} /> : null}
        {mine !== null && mine.saved !== null ? (
          <Banner family="positive" title={t("plr15r.saved", { n: mine.saved })} compact density="console" locale={locale}>
            {t("plr15r.savedText")}
          </Banner>
        ) : null}
        {approval !== null && approval.done ? <Banner family="positive" title={t("plr15r.approved", { n: approval.no })} compact density="console" locale={locale} /> : null}
        {data !== null ? <RuleSets data={data} attempt={mine} approval={approval !== null && !approval.done ? approval : null} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function RuleSets({ data, attempt, approval, t, locale }: { data: RuleSetView; attempt: RuleSetAttempt | null; approval: ApproveAttempt | null; t: Translate; locale: Locale }) {
  const refused = attempt !== null && attempt.saved === null ? attempt : null;
  const values: RuleSetInput = refused?.values ?? { loudness: "", transitions: "", effectiveFrom: "", premises: "" };
  const field = refused?.field ?? null;
  const error = (which: typeof field) => (field === which ? { error: t(`plr15r.need.${which ?? "loudness"}`) } : {});

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "flex-start" }}>
      <div style={{ flex: "3 1 var(--container-md)", minWidth: 0, maxWidth: "var(--container-3xl)" }}>
        <form action={draftRuleSet} noValidate style={{ display: "contents" }}>
          <Panel title={t("plr15r.formTitle", { n: data.nextNo })} description={t("plr15r.formHelp")} level={2} gap="xl" density="console" locale={locale}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <TextField label={t("plr15r.loudness")} name="loudness_rules" value={values.loudness} multiline rows={3} required {...error("loudness")} density="console" locale={locale} />
              <TextField label={t("plr15r.transitions")} name="transition_rules" value={values.transitions} multiline rows={3} required {...error("transitions")} density="console" locale={locale} />
              <DateField
                label={t("plr13.from")}
                name="effective_from"
                value={values.effectiveFrom}
                min={data.today}
                today={data.today}
                width="var(--space-60)"
                required
                helper={t("plr13.fromHelp")}
                {...(field === "from" && refused?.code !== "NO_EFFECTIVE_PERIOD" ? { error: t("plr13.need.from") } : {})}
                density="console"
                locale={locale}
              />
            </div>
            <Divider />
            {refused?.code === "NO_EFFECTIVE_PERIOD" ? (
              <Banner family="neutral" title={t("plr15r.noPeriodTitle")} code="NO_EFFECTIVE_PERIOD" density="console" locale={locale}>
                {t("plrops.refusal.NO_EFFECTIVE_PERIOD")}
              </Banner>
            ) : null}
            <ButtonRow>
              <ShortcutButton variant="primary" size="sm" type="submit" shortcut="Alt+S" locale={locale}>
                {t("plr13.draft")}
              </ShortcutButton>
              <Button variant="quiet" size="sm" href={routes.evidencePlaybackRules()} locale={locale}>
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

function Version({ version, approval, t, locale }: { version: RuleSetVersion; approval: ApproveAttempt | null; t: Translate; locale: Locale }) {
  const period = version.effectiveTo === null ? t("plr11c.from", { e: day(version.effectiveFrom, locale) }) : t("plr11c.between", { e: day(version.effectiveFrom, locale), to: day(version.effectiveTo, locale) });
  const state =
    version.status === "DRAFT"
      ? { family: "info" as const, label: t("plr11c.state.DRAFT") }
      : version.inEffect
        ? { family: "positive" as const, label: t("plr11.effective") }
        : { family: "neutral" as const, label: t("plr15r.state.APPROVED") };
  return (
    <Panel title={t("plr15r.versionTitle", { n: version.no })} level={2} density="console" locale={locale}>
      <FactList
        items={[
          { label: t("plr11c.fState"), value: state, kind: "status" },
          { label: t("plr11c.fPeriod"), value: period },
          { label: t("plr15r.loudness"), value: version.loudness === null ? null : said(version.loudness, locale), missing: t("plr15r.noText") },
          { label: t("plr15r.transitions"), value: version.transitions === null ? null : said(version.transitions, locale), missing: t("plr15r.noText") },
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
      {version.status === "DRAFT" ? (
        <form action={approveRuleSet.bind(null, version.no)} style={{ display: "contents" }}>
          <TextField label={t("plr13.note")} name="approval_note" value={approval?.values.note ?? ""} helper={t("plr13.noteHelp")} multiline rows={2} density="console" locale={locale} />
          {approval !== null && approval.code !== null ? (
            <Banner
              family="neutral"
              title={approval.code === "EFFECTIVE_PERIOD_OVERLAPS" && approval.overlaps !== null ? t("plr13.overlapTitle", { n: approval.overlaps }) : t("plr13.notApproved", { n: approval.no })}
              code={approval.code}
              density="console"
              locale={locale}
            >
              {t(`plrops.refusal.${approval.code}`)}
            </Banner>
          ) : null}
          <ButtonRow>
            <Button variant="primary" size="sm" type="submit" locale={locale}>
              {t("plr13.approve", { n: version.no })}
            </Button>
          </ButtonRow>
        </form>
      ) : null}
    </Panel>
  );
}

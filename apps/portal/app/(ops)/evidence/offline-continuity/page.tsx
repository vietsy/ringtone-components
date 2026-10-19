import { ApprovalPair, Banner, Button, ButtonRow, DateField, Divider, PageHeader, Panel, Select, TextField, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { count, day, plropsTranslator } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { approveOfflinePolicy, draftOfflinePolicy } from "@/features/player-ops/actions";
import { ShortcutButton } from "@/features/player-ops/ShortcutButton";
import { readForPage } from "@/lib/api/flash";
import { loadOfflinePolicy, type ApproveAttempt, type OfflineAttempt, type OfflineInput, type OfflinePolicyView } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR13_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-13 Offline-continuity policy: a version needs all four parts - the maximum offline period, what happens when
 * it is exceeded, how expiry, revocation and takedown reach a device, and the grace period - and is saved as a draft.
 * The specification draws no control for its approval (POST .../{id}/approve), so Approve sits here, beside the draft
 * it acts on. An approved version governs from its effective date; until then the interim rule of BR-PLR-19 stays in
 * force, which is the limit the premises portal shows on a device past it (SCR-PLR-05).
 */
export default async function OfflineContinuityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-EVD");
  const query = await searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(query, PLR13_VIEWS);
  const attempt = readForPage<OfflineAttempt | ApproveAttempt>(query);
  const mine = attempt?.page === "offline" ? attempt : null;
  const approval = attempt?.page === "approve" && attempt.policy === "offline" ? attempt : null;
  const outcome = view === "loading" ? null : await loadOfflinePolicy(staff, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const draft = data?.draft ?? null;
  const upcoming = data?.approved[0] ?? null;

  return (
    <OpsFrame console="evidence" current="offlinePolicy" staff={staff} searchLabel={t("plrops.evSearch")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.evArea") }, { label: t("plr13.crumb") }, { label: t("plr13.title") }]}
          title={t("plr13.title")}
          {...(data !== null
            ? {
                status:
                  data.effective !== null
                    ? { family: "positive" as const, label: t("plr13.effective", { n: data.effective.no }) }
                    : upcoming !== null
                      ? { family: "info" as const, label: t("plr13.upcoming", { n: upcoming.no, d: day(upcoming.effectiveFrom, locale) }) }
                      : { family: "attention" as const, label: t("plr13.none") },
                meta:
                  draft !== null
                    ? t(data.effective !== null ? "plr13.metaGoverned" : "plr13.meta", { n: draft.no, who: draft.preparedBy, d: day(draft.preparedAt, locale) })
                    : t(data.effective !== null ? "plr13.metaNoneGoverned" : "plr13.metaNone"),
              }
            : {})}
          locale={locale}
        />
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={6} density="console" locale={locale} /> : null}
        {failure !== null ? <Failure failure={failure} errorText={t("plr13.errText")} prefix="plrops" t={t} locale={locale} /> : null}
        {mine !== null && mine.saved !== null ? (
          <Banner family="positive" title={t("plr13.saved", { n: mine.saved })} compact density="console" locale={locale}>
            {t("plr13.savedText")}
          </Banner>
        ) : null}
        {approval !== null && approval.done ? (
          <Banner family="positive" title={t("plr13.approved", { n: approval.no })} compact density="console" locale={locale}>
            {data?.effective?.no === approval.no ? t("plr13.approvedNow") : t("plr13.approvedLater")}
          </Banner>
        ) : null}
        {data !== null ? <Policy data={data} attempt={mine} approval={approval !== null && !approval.done ? approval : null} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Policy({ data, attempt, approval, t, locale }: { data: OfflinePolicyView; attempt: OfflineAttempt | null; approval: ApproveAttempt | null; t: Translate; locale: Locale }) {
  const draft = data.draft;
  const refused = attempt !== null && attempt.saved === null ? attempt : null;
  const values: OfflineInput = refused?.values ?? {
    maxOfflineHours: draft === null ? "" : String(draft.maxOfflineHours),
    exceeded: draft?.exceeded ?? "STOP",
    propagation: draft?.propagation ?? "NEXT_SYNC",
    graceHours: draft === null ? "" : String(draft.graceHours),
    effectiveFrom: draft?.effectiveFrom ?? "",
  };
  const part = refused?.part ?? null;
  const error = (which: typeof part) => (part === which ? { error: t(`plr13.need.${which ?? "max"}`) } : {});

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "flex-start" }}>
      <div style={{ flex: "3 1 var(--container-md)", minWidth: 0, maxWidth: "var(--container-3xl)" }}>
        {/* The API, not the browser, says which of the four parts is missing (POLICY_INCOMPLETE names it). */}
        <form action={draftOfflinePolicy} noValidate style={{ display: "contents" }}>
          <Panel title={t("plr13.formTitle", { n: draft?.no ?? data.nextNo })} description={t("plr13.formHelp")} level={2} gap="xl" density="console" locale={locale}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <TextField
                label={t("plr13.max")}
                name="max_offline_hours"
                value={values.maxOfflineHours}
                suffix={t("plr13.hours")}
                inputMode="numeric"
                width="var(--space-40)"
                required
                {...error("max")}
                density="console"
                locale={locale}
              />
              <Select
                label={t("plr13.exceeded")}
                name="when_exceeded"
                options={[{ value: "STOP", label: t("plr13.stop") }]}
                value={values.exceeded}
                required
                {...error("exceeded")}
                density="console"
                locale={locale}
              />
              <Select
                label={t("plr13.propagation")}
                name="propagation_rule"
                options={[{ value: "NEXT_SYNC", label: t("plr13.nextSync") }]}
                value={values.propagation}
                required
                {...error("propagation")}
                density="console"
                locale={locale}
              />
              <TextField
                label={t("plr13.grace")}
                name="grace_period_hours"
                value={values.graceHours}
                suffix={t("plr13.hours")}
                inputMode="numeric"
                width="var(--space-40)"
                required
                {...(part === "grace" ? { error: t("plr13.need.grace") } : { info: t("plr13.graceInfo") })}
                density="console"
                locale={locale}
              />
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
            {refused?.code === "POLICY_INCOMPLETE" && part !== null && part !== "from" ? (
              <Banner family="neutral" title={t("plr13.refTitle", { part: t(`plr13.part.${part}`) })} code="POLICY_INCOMPLETE" density="console" locale={locale}>
                {t("plrops.refusal.POLICY_INCOMPLETE")}
              </Banner>
            ) : null}
            <ButtonRow>
              <ShortcutButton variant="primary" size="sm" type="submit" shortcut="Alt+S" locale={locale}>
                {t("plr13.draft")}
              </ShortcutButton>
              <Button variant="quiet" size="sm" href={routes.evidenceOfflinePolicy()} locale={locale}>
                {t("plr13.cancel")}
              </Button>
            </ButtonRow>
          </Panel>
        </form>
      </div>
      <div style={{ flex: "2 1 var(--container-xs)", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {data.limitNow.source === "policy" && data.effective !== null ? (
          <Panel title={t("plr13.governedTitle", { n: data.effective.no })} level={2} density="console" locale={locale}>
            <Text size="sm">
              {t("plr13.governed", { h: count(data.limitNow.hours, locale), max: count(data.effective.maxOfflineHours, locale), g: count(data.effective.graceHours, locale) })}
            </Text>
          </Panel>
        ) : (
          <Panel title={t("plr13.interimTitle")} level={2} density="console" locale={locale}>
            <Text size="sm">{t("plr13.interim1")}</Text>
            <Text size="sm" tone="secondary">
              {t("plr13.interim2")}
            </Text>
          </Panel>
        )}
        {draft !== null ? (
          <form action={approveOfflinePolicy.bind(null, draft.no)} style={{ display: "contents" }}>
            <Panel title={t("plr13.approvalTitle")} description={t("plr13.approvalNote", { d: day(draft.effectiveFrom, locale) })} level={2} density="console" locale={locale}>
              <ApprovalPair preparer={{ name: draft.preparedBy, role: t("plr13.preparerRole"), at: draft.preparedAt }} approver={null} locale={locale} />
              <TextField label={t("plr13.note")} name="approval_note" value={approval?.values.note ?? ""} helper={t("plr13.noteHelp")} multiline rows={2} density="console" locale={locale} />
              {approval !== null && approval.code !== null ? (
                <Banner
                  family="neutral"
                  title={
                    approval.code === "POLICY_INCOMPLETE" && approval.part !== null
                      ? t("plr13.refTitle", { part: t(`plr13.part.${approval.part}`) })
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
                  {t("plr13.approve", { n: draft.no })}
                </Button>
              </ButtonRow>
            </Panel>
          </form>
        ) : null}
        {[...(data.effective !== null ? [data.effective] : []), ...data.approved].map((version) => (
          <Panel key={version.no} title={t("plr13.approvedTitle", { n: version.no, d: day(version.effectiveFrom, locale) })} level={2} density="console" locale={locale}>
            <ApprovalPair
              preparer={{ name: version.preparedBy, role: t("plr13.preparerRole"), at: version.preparedAt }}
              approver={version.approvedBy === null ? null : { name: version.approvedBy, role: t("plr13.preparerRole"), ...(version.approvedAt !== null ? { at: version.approvedAt } : {}) }}
              decision="approved"
              locale={locale}
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}

import { Banner, ButtonRow, PageHeader, Panel, Skeleton, Table, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { approveDisclosureAct, endDisclosureAct } from "@/features/engagement/actions";
import { ConfirmAct } from "@/features/engagement/ConfirmAct";
import { actorName, count, engTranslator, fieldParts, moment, readInstant } from "@/features/engagement/copy";
import { DisclosureDraft } from "@/features/engagement/DisclosureDraft";
import { PolicyTabs } from "@/features/engagement/PolicyTabs";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { readForPage } from "@/lib/api/flash";
import { loadDisclosureVersions, type DisclosureVersion, type DisclosureVersionsView, type EngagementAttempt } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const STATE_FAMILY = { APPROVED: "info", EFFECTIVE: "positive", SUPERSEDED: "neutral", ENDED: "attention" } as const;

const END_FORM = "eng13-end";

/**
 * SCR-ENG-13 Disclosure version, on the policy console. No board or Figma frame draws it: it is built from ENG's
 * specification and wireframe. Every version with its state and the period it was shown for, and for the DPO the
 * draft of the next one: both languages, the reserving decision and an effective instant that is never defaulted to
 * now. Approve names the missing language while disabled, and confirms with *this becomes what every participant is
 * told about their points*. Anyone else reads the versions; approving is the DPO's, and the page says so. The DPO may
 * also end the effective version with none to follow, as UAT-ENG-07 does: confirmed, from then no participant is shown
 * a figure (DISCLOSURE_VERSION_NOT_EFFECTIVE) until a new version is effective.
 */
export default async function DisclosureVersionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS", "ACT-DPO", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const outcome = view === "loading" ? null : await loadDisclosureVersions(staff, view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept?.page === "eng13" || kept?.page === "eng13-end" ? kept : null;
  const data = outcome?.data ?? null;

  return (
    <OpsFrame console="policy" current="engagement" staff={staff} searchLabel={t("engPolicy.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("eng06.title"), href: routes.policyAwardRules() }]} title={t("eng13.title")} meta={t("eng13.meta")} locale={locale} />
        <PolicyTabs current="disclosure" t={t} locale={locale} />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="table" rows={2} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng13.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {data !== null ? <Versions data={data} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

const period = (version: DisclosureVersion, t: Translate, locale: Locale) => (version.effectiveTo !== null ? moment(version.effectiveTo, locale) : t("eng13.open"));

function Versions({ data, attempt, t, locale }: { data: DisclosureVersionsView; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const ending = attempt?.page === "eng13-end";
  const refusal = ending ? null : (attempt?.refusal ?? null);
  const effectiveMissing = refusal?.code === "FIELD_MISSING" && refusal.values.field === "effective_from";
  const draft = attempt?.form ?? {};
  const at = fieldParts(readInstant(draft.effective_from ?? ""));
  const approved = attempt?.done === "approved" ? (data.versions.at(-1) ?? null) : null;
  const ended = attempt?.done === "ended" ? ([...data.versions].reverse().find((version) => version.state === "ENDED") ?? null) : null;
  const effective = data.versions.find((version) => version.state === "EFFECTIVE") ?? null;
  // A new draft names the decision reserving the treatment today: the one the version in effect names, or after a lapse the last one's.
  const decision = (data.versions.find((version) => version.state === "EFFECTIVE") ?? data.versions.at(-1))?.reservingDecision ?? "";
  return (
    <>
      {approved !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t("eng13.doneTitle", { n: approved.no })} locale={locale}>
            {t("eng13.doneText", { ts: moment(approved.effectiveFrom, locale) })}
          </Toast>
        </div>
      ) : null}
      {ended !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="attention" title={t("eng13.endedTitle", { n: ended.no })} locale={locale}>
            {t("eng13.endedText")}
          </Toast>
        </div>
      ) : null}
      {ending && attempt?.refusal ? <RefusalBanner refusal={attempt.refusal} t={t} locale={locale} density="console" /> : null}
      {data.lapsed ? (
        <Banner family="attention" title={t("eng.refusal.DISCLOSURE_VERSION_NOT_EFFECTIVE.title")} density="console" locale={locale}>
          {t("eng13.lapsed")}
        </Banner>
      ) : null}
      <Panel title={t("eng13.versionsTitle")} level={2} compact density="console" locale={locale}>
        <Table
          columns={[
            { key: "no", label: t("eng13.cVersion"), kind: "strong" },
            { key: "state", label: t("eng13.cState"), kind: "status" },
            { key: "from", label: t("eng13.cFrom"), kind: "datetime" },
            { key: "to", label: t("eng13.cTo") },
            { key: "decision", label: t("eng13.cDecision"), kind: "mono" },
            { key: "approved", label: t("eng13.cApproved"), kind: "stack" },
          ]}
          rows={data.versions.map((version) => ({
            _key: String(version.no),
            no: t("eng13.versionNo", { n: version.no }),
            state: { family: STATE_FAMILY[version.state], label: t(`eng13.state.${version.state}`) },
            from: version.effectiveFrom,
            to: period(version, t, locale),
            decision: version.reservingDecision,
            approved: { text: actorName(version.approvedBy, t), detail: moment(version.approvedAt, locale) },
          }))}
          density="console"
          caption={t("eng13.versionsTitle")}
          footer={t("eng.showing", { shown: count(data.versions.length, locale), total: count(data.versions.length, locale) })}
          locale={locale}
        />
      </Panel>
      {data.dpo && effective !== null ? (
        <Panel title={t("eng13.endTitle")} level={2} density="console" locale={locale}>
          <Text size="sm" tone="secondary" measure="2xl">
            {t("eng13.endText")}
          </Text>
          <form id={END_FORM} action={endDisclosureAct} />
          <ButtonRow>
            <ConfirmAct
              formId={END_FORM}
              label={t("eng13.end")}
              variant="secondary"
              dialog={{ title: t("eng13.endDialog", { n: effective.no }), description: t("eng13.endConfirm"), confirm: t("eng13.end"), back: t("eng.back") }}
              locale={locale}
            />
          </ButtonRow>
        </Panel>
      ) : null}
      <Panel title={t("eng13.draftTitle", { n: data.versions.length + 1 })} level={2} density="console" locale={locale}>
        {refusal !== null && !effectiveMissing ? <RefusalBanner refusal={refusal} t={t} locale={locale} density="console" /> : null}
        {data.dpo ? (
          <DisclosureDraft
            action={approveDisclosureAct}
            copy={{
              en: t("eng13.en"),
              enHelp: t("eng13.enHelp"),
              vi: t("eng13.vi"),
              viHelp: t("eng13.viHelp"),
              decision: t("eng13.decision"),
              decisionHelp: t("eng13.decisionHelp"),
              effective: t("eng13.effective"),
              effectiveHelp: t("eng13.effectiveHelp"),
              approve: t("eng13.approve"),
              cancel: t("eng13.cancel"),
              missingVi: t("eng.missing.vi"),
              missingEn: t("eng.missing.en"),
              missingDecision: t("eng.missing.decision"),
              dialogTitle: t("eng13.dialogTitle", { n: data.versions.length + 1 }),
              dialogText: t("eng13.dialogText"),
              dialogYes: t("eng13.approve"),
              dialogBack: t("eng.back"),
            }}
            initial={{
              textEn: draft.treatment_text_en ?? "",
              textVi: draft.treatment_text_vi ?? "",
              reservingDecision: draft.reserving_decision ?? decision,
              date: at.date,
              time: at.time,
            }}
            defaultDecision={decision}
            effectiveError={effectiveMissing ? t("eng13.effectiveMissing") : null}
            locale={locale}
          />
        ) : (
          <Banner family="neutral" title={t("eng13.dpoOnly")} density="console" locale={locale}>
            {t("eng13.dpoOnlyText")}
          </Banner>
        )}
      </Panel>
    </>
  );
}

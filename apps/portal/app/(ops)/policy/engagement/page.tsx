import { ApprovalPair, Button, ButtonRow, DateField, FactList, PageHeader, Panel, Skeleton, Table, TextField, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { approveVersionAct, prepareVersionAct, withdrawVersionAct } from "@/features/engagement/actions";
import { ConfirmAct } from "@/features/engagement/ConfirmAct";
import { actionNote, actorName, count, engTranslator, fieldParts, moment, readInstant, refusalSentence, refusalWords, versionStatus } from "@/features/engagement/copy";
import { PolicyTabs } from "@/features/engagement/PolicyTabs";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { readForPage } from "@/lib/api/flash";
import { loadRuleVersions, type EngagementAttempt, type RuleVersion, type RuleVersionsView } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** An action's code, with its words under it where the family names the action. */
function codeCell(code: string, t: Translate) {
  const words = actionNote(code, t);
  return { text: code, ...(words !== null ? { detail: words } : {}), mono: true };
}

const APPROVE_FORM = "eng06-approve";

/** Where an effective instant stands: the one approved, the one proposed with the submission, or not set (never a default). */
function effectiveWords(version: RuleVersion, t: Translate, locale: Locale): string {
  if (version.effectiveFrom === null) return t("eng06.notSet");
  return version.approvedAt !== null ? moment(version.effectiveFrom, locale) : t("eng06.proposed", { ts: moment(version.effectiveFrom, locale) });
}

/**
 * SCR-ENG-06 Award rule versions, the landing of the policy console's engagement workspace. No board or Figma frame
 * draws it: it is built from ENG's specification and wireframe on the policy console's pattern. Every version with
 * its state, effective period, preparer and approver, both shown because the separation is what a reader checks; the
 * selected one's actions and the acts on it. Approve is disabled for the person who prepared it with the words naming
 * who may approve, never *you do not have permission*, and confirms with the effective instant in the sentence.
 */
export default async function AwardRuleVersionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS", "ACT-DPO", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const asked = Number(typeof params.version === "string" ? params.version : "");
  const outcome = view === "loading" ? null : await loadRuleVersions(staff, Number.isInteger(asked) && asked > 0 ? asked : null, view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept?.page === "eng06" ? kept : null;
  const data = outcome?.data ?? null;

  return (
    <OpsFrame console="policy" current="engagement" staff={staff} searchLabel={t("engPolicy.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("eng06.title")} meta={t("eng06.meta")} locale={locale}>
          {data?.mayPrepare ? (
            <form action={prepareVersionAct}>
              <Button type="submit" variant="primary" size="sm" icon="plus" locale={locale}>
                {t("eng06.prepare")}
              </Button>
            </form>
          ) : null}
        </PageHeader>
        <PolicyTabs current="rules" t={t} locale={locale} />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="table" rows={3} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng06.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {data !== null ? <Versions data={data} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Versions({ data, attempt, t, locale }: { data: RuleVersionsView; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const selected = data.selected;
  const refusal = attempt?.refusal ?? null;
  const inline = refusal !== null && (refusal.code === "AWARD_RULE_SELF_APPROVAL" || refusal.code === "EFFECTIVE_FROM_IN_PAST" || (refusal.code === "FIELD_MISSING" && refusal.values.field === "reason"));
  return (
    <>
      {attempt?.done !== null && attempt?.done !== undefined && selected !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family={attempt.done === "withdrawn" ? "neutral" : "positive"} title={t(`eng06.done.${attempt.done}`, { n: selected.no })} locale={locale}>
            {t(`eng06.doneText.${attempt.done}`, { ts: selected.effectiveFrom !== null ? moment(selected.effectiveFrom, locale) : "" })}
          </Toast>
        </div>
      ) : null}
      {refusal !== null && !inline ? <RefusalBanner refusal={refusal} t={t} locale={locale} density="console" /> : null}
      <Panel compact density="console" locale={locale}>
        <Table
          columns={[
            { key: "no", label: t("eng06.cVersion"), kind: "strong" },
            { key: "state", label: t("eng06.cState"), kind: "status" },
            { key: "from", label: t("eng06.cFrom") },
            { key: "prepared", label: t("eng06.cPrepared"), kind: "stack" },
            { key: "approved", label: t("eng06.cApproved"), kind: "stack" },
          ]}
          rows={data.versions.map((version) => ({
            _key: String(version.no),
            _href: routes.policyAwardRules(version.no),
            ...(version.no === selected?.no ? { _selected: true } : {}),
            no: t("eng06.versionNo", { n: version.no }),
            state: versionStatus(version.state, t),
            from: effectiveWords(version, t, locale),
            prepared: { text: actorName(version.preparedBy, t), detail: moment(version.preparedAt, locale) },
            approved: version.approvedBy !== null ? { text: actorName(version.approvedBy, t), detail: moment(version.approvedAt ?? "", locale) } : { text: t("eng06.notApproved"), muted: true },
          }))}
          density="console"
          rowFocus
          caption={t("eng06.title")}
          footer={t("eng.showing", { shown: count(data.versions.length, locale), total: count(data.versions.length, locale) })}
          locale={locale}
        />
      </Panel>
      {selected !== null ? <Selected version={selected} data={data} attempt={attempt} t={t} locale={locale} /> : null}
    </>
  );
}

function Selected({ version, data, attempt, t, locale }: { version: RuleVersion; data: RuleVersionsView; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const prepared = version.state === "PREPARED";
  const refusal = attempt?.refusal ?? null;
  const own = data.preparedSelected;
  const self = refusalWords("AWARD_RULE_SELF_APPROVAL", t);
  const typed = attempt?.form.effective_from;
  const at = fieldParts(typed !== undefined && typed !== "" ? readInstant(typed) : version.effectiveFrom);
  const reasonMissing = refusal?.code === "FIELD_MISSING" && refusal.values.field === "reason";
  // The refusal's last sentence says an attempt was recorded; before an attempt, the separation is said without it.
  const attempted = refusal?.code === "AWARD_RULE_SELF_APPROVAL";
  return (
    <Panel title={t("eng06.selectedTitle", { n: version.no })} level={2} status={versionStatus(version.state, t)} density="console" locale={locale}>
      <FactList
        columns={2}
        density="console"
        locale={locale}
        items={[
          { label: t("eng06.fFrom"), value: effectiveWords(version, t, locale) },
          { label: t("eng06.fTo"), value: version.effectiveTo !== null ? moment(version.effectiveTo, locale) : t("eng06.open") },
          { label: t("eng06.fReferral"), value: t(version.referral ? "eng.yes" : "eng.no") },
          { label: t("eng06.fSubmitted"), value: version.submittedAt !== null ? moment(version.submittedAt, locale) : t("eng06.notSubmitted") },
          ...(version.withdrawnAt !== null
            ? [{ label: t("eng06.fWithdrawn"), value: t("eng06.withdrawnValue", { name: version.withdrawnBy !== null ? actorName(version.withdrawnBy, t) : "", ts: moment(version.withdrawnAt, locale), reason: version.withdrawalReason ?? "" }) }]
            : []),
        ]}
      />
      <Table
        columns={[
          { key: "code", label: t("eng07.cCode"), kind: "stack" },
          { key: "cls", label: t("eng07.cClass") },
          { key: "value", label: t("eng07.cValue"), kind: "count", align: "end" },
        ]}
        rows={version.actions.map((action) => ({ _key: action.code, code: codeCell(action.code, t), cls: t(`eng.class.${action.participantClass}`), value: action.value }))}
        density="console"
        caption={t("eng06.actionsTitle", { n: version.no })}
        empty={{ variant: "governed", title: t("eng07.empty"), action: false }}
        locale={locale}
      />
      <ApprovalPair
        preparer={{ name: actorName(version.preparedBy, t), role: t("eng06.preparerRole"), at: version.preparedAt }}
        approver={version.approvedBy !== null ? { name: actorName(version.approvedBy, t), role: t("eng06.approverRole"), at: version.approvedAt ?? "" } : null}
        {...(version.approvedBy !== null ? { decision: "approved" as const } : { awaiting: t("eng06.awaiting") })}
        {...(own && prepared ? { sameActor: { code: "AWARD_RULE_SELF_APPROVAL", title: self.title, text: attempted ? self.text : t("eng06.ownText"), family: "attention" as const } } : {})}
        preparerLabel={t("eng06.preparer")}
        approverLabel={t("eng06.approver")}
        locale={locale}
      />
      {prepared && (data.mayApprove || own) ? (
        <form id={APPROVE_FORM} action={approveVersionAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <input type="hidden" name="version" value={version.no} />
          {!own ? (
            <DateField
              label={t("eng06.effective")}
              helper={t("eng06.effectiveHelp")}
              name="effective_from"
              {...(at.date !== "" ? { value: at.date, time: at.time } : {})}
              withTime
              required
              {...(refusal?.code === "EFFECTIVE_FROM_IN_PAST" ? { error: refusalSentence("EFFECTIVE_FROM_IN_PAST", t) } : {})}
              density="console"
              width="var(--container-xs)"
              locale={locale}
            />
          ) : null}
          <ButtonRow>
            <ConfirmAct
              formId={APPROVE_FORM}
              label={t("eng06.approve")}
              disabledReason={own ? t("eng06.ownReason") : version.actions.length === 0 ? t("eng07.empty") : null}
              dialog={{ title: t("eng06.approveDialog", { n: version.no }), description: t("eng06.approveConfirm"), confirm: t("eng06.approve"), back: t("eng.back") }}
              fill={{ field: "effective_from", token: "{ts}", empty: t("eng06.notSet") }}
              locale={locale}
            />
          </ButtonRow>
        </form>
      ) : null}
      {(prepared || version.state === "APPROVED") && data.mayApprove ? (
        <form action={withdrawVersionAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <input type="hidden" name="version" value={version.no} />
          <TextField
            label={t("eng06.reason")}
            helper={t("eng06.reasonHelp")}
            name="reason"
            value={attempt?.form.reason ?? ""}
            maxLength={500}
            {...(reasonMissing ? { error: t("eng06.reasonMissing") } : {})}
            density="console"
            locale={locale}
          />
          <ButtonRow>
            <Button type="submit" variant="danger" size="sm" locale={locale}>
              {t("eng06.withdraw")}
            </Button>
          </ButtonRow>
        </form>
      ) : null}
      {!data.mayApprove && !own && prepared ? (
        <Text size="sm" tone="secondary">
          {t("eng06.approverOnly")}
        </Text>
      ) : null}
      {prepared ? (
        <ButtonRow>
          <Button variant="secondary" size="sm" icon="file-text" href={routes.policyAwardRuleEditor(version.no)} locale={locale}>
            {t("eng06.openEditor")}
          </Button>
        </ButtonRow>
      ) : null}
    </Panel>
  );
}

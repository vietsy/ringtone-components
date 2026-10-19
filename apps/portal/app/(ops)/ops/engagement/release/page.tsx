import { Button, ButtonRow, ChoiceList, DateField, FactList, PageHeader, Panel, Skeleton, Table, TextField, Timeline, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { releaseAct } from "@/features/engagement/actions";
import { ConfirmAct } from "@/features/engagement/ConfirmAct";
import { actorName, capabilityStatus, classWords, engTranslator, evidenceWords, fieldParts, moment, readInstant } from "@/features/engagement/copy";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { readForPage } from "@/lib/api/flash";
import { loadCapabilityRelease, type CapabilityReleaseView, type EngagementAttempt, type ParticipantClass } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const RELEASE_FORM = "eng12-release";
const CHANGE_FORM = "eng12-change";
const CLASSES: readonly ParticipantClass[] = ["artist", "premises"];

/**
 * SCR-ENG-12 Capability release. No board or Figma frame draws it: it is built from ENG's specification and wireframe
 * on the console pattern. The withheld state is the subject here, not an obstacle: every condition of `CG-ENG` with
 * its evidence and whether it is effective, Release disabled with the condition that carries no evidence named (never
 * a count), and once a release exists Suspend, Resume and Withdraw, each confirmed with what it does. Only the
 * independent business approver acts; the operations officer and the auditor read.
 */
export default async function CapabilityReleasePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const outcome = view === "loading" ? null : await loadCapabilityRelease(staff, view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept !== null && kept.page.startsWith("eng12-") ? kept : null;
  const data = outcome?.data ?? null;

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("engHome.title"), href: routes.opsEngagement() }]}
          title={t("eng12.title")}
          meta={t("eng12.meta")}
          {...(data !== null ? { status: capabilityStatus(data.capability.state, t) } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="table" rows={4} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng12.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {data !== null ? <Release data={data} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Release({ data, attempt, t, locale }: { data: CapabilityReleaseView; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const missing = data.conditions.find((condition) => !condition.effective) ?? null;
  const missingWords = missing !== null ? t("eng12.missing", { condition: t(`eng.condition.${missing.code}`) }) : null;
  const withheld = data.release === null;
  const done = attempt?.done ?? null;
  const groundMissing = attempt?.refusal?.code === "FIELD_MISSING" && attempt.refusal.values.field === "ground";
  return (
    <>
      {done !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family={done === "release" || done === "resume" ? "positive" : "neutral"} title={t(`eng12.done.${done}`)} locale={locale}>
            {t(`eng12.doneText.${done}`)}
          </Toast>
        </div>
      ) : null}
      {attempt?.refusal && !groundMissing ? <RefusalBanner refusal={attempt.refusal} t={t} locale={locale} density="console" /> : null}
      <Panel title={t("eng12.conditionsTitle")} level={2} compact density="console" locale={locale}>
        <Table
          columns={[
            { key: "condition", label: t("eng12.cCondition"), kind: "strong" },
            { key: "evidence", label: t("eng12.cEvidence") },
            { key: "from", label: t("eng12.cFrom"), kind: "datetime", missing: t("eng12.notEffective") },
            { key: "state", label: t("eng12.cState"), kind: "status" },
          ]}
          rows={data.conditions.map((condition) => ({
            _key: condition.code,
            condition: t(`eng.condition.${condition.code}`),
            evidence: evidenceWords(condition, t),
            from: condition.effectiveFrom,
            state: condition.effective ? { family: "positive", label: t("eng12.evidenced") } : { family: "attention", label: t("eng12.unevidenced") },
          }))}
          density="console"
          caption={t("eng12.conditionsTitle")}
          footer={t("eng.showing", { shown: data.conditions.length, total: data.conditions.length })}
          locale={locale}
        />
      </Panel>
      {data.release !== null ? (
        <Panel title={t("eng12.releaseTitle")} level={2} status={capabilityStatus(data.release.state, t)} density="console" locale={locale}>
          <FactList
            columns={2}
            density="console"
            locale={locale}
            items={[
              { label: t("eng12.fScope"), value: classWords(data.release.scope, t) },
              { label: t("eng12.fFrom"), value: data.release.effectiveFrom, kind: "datetime" },
              { label: t("eng12.fApproved"), value: t("eng12.approvedValue", { name: actorName(data.release.approvedBy, t), ts: moment(data.release.approvedAt, locale) }) },
              { label: t("eng12.fId"), value: data.release.id, kind: "id" },
            ]}
          />
        </Panel>
      ) : null}
      {!data.mayAct ? (
        <Text size="sm" tone="secondary">
          {t("eng12.readOnly")}
        </Text>
      ) : withheld ? (
        <ReleaseForm data={data} missingWords={missingWords} attempt={attempt} t={t} locale={locale} />
      ) : (
        <ChangeForm data={data} missingWords={missingWords} groundMissing={groundMissing} attempt={attempt} t={t} locale={locale} />
      )}
      {data.history.length > 0 ? (
        <Panel title={t("eng12.historyTitle")} level={2} density="console" locale={locale}>
          <Timeline
            entries={data.history.map((entry, index) => ({
              id: String(index),
              at: entry.at,
              actor: actorName(entry.actor, t),
              title: t("eng12.transition", { from: t(`eng.capability.${entry.from ?? "WITHHELD"}`), to: t(`eng.capability.${entry.to}`) }),
              ...(entry.ground !== null ? { detail: t("eng12.groundLine", { ground: entry.ground }) } : {}),
              status: capabilityStatus(entry.to, t),
            }))}
            locale={locale}
          />
        </Panel>
      ) : null}
    </>
  );
}

/** Scope and effective instant, neither defaulted to now; Release confirmed with what it makes operate. */
function ReleaseForm({ data, missingWords, attempt, t, locale }: { data: CapabilityReleaseView; missingWords: string | null; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const typed = attempt?.page === "eng12-release" ? attempt.form : null;
  const scope = typed?.scope !== undefined && typed.scope !== "" ? typed.scope.split(",") : ["artist"];
  const at = typed?.effective_from !== undefined ? fieldParts(readInstant(typed.effective_from)) : { date: "", time: "" };
  const fieldMissing = attempt?.refusal?.code === "FIELD_MISSING" ? String(attempt.refusal.values.field ?? "") : null;
  return (
    <Panel title={t("eng12.releaseFormTitle")} level={2} density="console" locale={locale}>
      <form id={RELEASE_FORM} action={releaseAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <input type="hidden" name="intent" defaultValue="release" />
        <ChoiceList
          legend={t("eng12.scope")}
          helper={t("eng12.scopeHelp")}
          name="scope"
          multiple
          layout="inline"
          options={CLASSES.map((value) => ({ value, label: t(`eng.class.${value}`) }))}
          value={scope}
          {...(fieldMissing === "scope" ? { error: t("eng12.scopeMissing") } : {})}
          density="console"
          locale={locale}
        />
        <DateField
          label={t("eng12.effective")}
          helper={t("eng12.effectiveHelp")}
          name="effective_from"
          {...(at.date !== "" ? { value: at.date, time: at.time } : {})}
          withTime
          required
          {...(fieldMissing === "effective_from" ? { error: t("eng12.effectiveMissing") } : {})}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
      </form>
      <ButtonRow>
        <ConfirmAct
          formId={RELEASE_FORM}
          intent="release"
          label={t("eng12.release")}
          disabledReason={missingWords}
          dialog={{ title: t("eng12.releaseDialog"), description: t("eng12.releaseConfirm"), confirm: t("eng12.release"), back: t("eng.back") }}
          locale={locale}
        />
      </ButtonRow>
      {data.capability.effectiveFrom !== null ? (
        <Text size="sm" tone="secondary">
          {t("eng12.later", { ts: moment(data.capability.effectiveFrom, locale) })}
        </Text>
      ) : null}
    </Panel>
  );
}

/** Suspend while released, Resume while suspended once every condition is effective again, Withdraw while a release exists. */
function ChangeForm({
  data,
  missingWords,
  groundMissing,
  attempt,
  t,
  locale,
}: {
  data: CapabilityReleaseView;
  missingWords: string | null;
  groundMissing: boolean;
  attempt: EngagementAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const state = data.release?.state ?? "WITHHELD";
  return (
    <Panel title={t("eng12.changeTitle")} level={2} density="console" locale={locale}>
      <form id={CHANGE_FORM} action={releaseAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <input type="hidden" name="intent" defaultValue="suspend" />
        <TextField
          label={t("eng12.ground")}
          helper={t("eng12.groundHelp")}
          name="ground"
          value={attempt?.form.ground ?? ""}
          multiline
          rows={2}
          maxLength={500}
          {...(groundMissing ? { error: t("eng12.groundMissing") } : {})}
          density="console"
          locale={locale}
        />
      </form>
      <ButtonRow>
        {state === "RELEASED" ? (
          <ConfirmAct
            formId={CHANGE_FORM}
            intent="suspend"
            variant="secondary"
            label={t("eng12.suspend")}
            dialog={{ title: t("eng12.suspendDialog"), description: t("eng12.suspendConfirm"), confirm: t("eng12.suspend"), back: t("eng.back") }}
            locale={locale}
          />
        ) : null}
        {state === "SUSPENDED" ? (
          <form action={releaseAct}>
            <input type="hidden" name="intent" value="resume" />
            <Button type="submit" variant="primary" size="sm" {...(missingWords !== null ? { disabled: true, disabledReason: missingWords } : {})} locale={locale}>
              {t("eng12.resume")}
            </Button>
          </form>
        ) : null}
        <ConfirmAct
          formId={CHANGE_FORM}
          intent="withdraw"
          variant="danger"
          label={t("eng12.withdraw")}
          dialog={{ title: t("eng12.withdrawDialog"), description: t("eng12.withdrawConfirm"), confirm: t("eng12.withdraw"), back: t("eng.back") }}
          locale={locale}
        />
      </ButtonRow>
    </Panel>
  );
}

import { Banner, Button, ButtonRow, DateField, FactList, PageHeader, Panel, Select, Skeleton, TextField, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { recordQualifyingActionAct } from "@/features/engagement/actions";
import { actionNote, count, engTranslator, fieldParts, moment, readInstant } from "@/features/engagement/copy";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { readForPage } from "@/lib/api/flash";
import { loadQualifyingActionForm, type EngagementAttempt, type QualifyingActionForm } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim() : "");

/**
 * SCR-ENG-08 Record a qualifying action, for an action that reached the programme outside an event. No board or Figma
 * frame draws it: it is built from ENG's specification and wireframe. The participant and the instant the act happened
 * come first; the governing version and the value are resolved from them and shown before Record is offered, with
 * *you do not choose it* beside the value, and the code is chosen from what that version lists, with the subject the act
 * was about (a track, or nothing beyond the participant) and the display profile it happened under. The two rule
 * refusals are drawn apart, because one is a gap for the policy preparer and the other somebody's withdrawal; the same
 * act already recorded with another payload is QUALIFYING_ACTION_CONFLICT, which names the event and the correction route.
 */
export default async function QualifyingActionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const participant = text(params.participant);
  const atRaw = text(params.at);
  const at = readInstant(atRaw);
  const asked = participant !== "" || atRaw !== "" ? { participant, at: at ?? "" } : null;
  const outcome = view === "loading" ? null : await loadQualifyingActionForm(staff, asked, view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept?.page === "eng08" ? kept : null;
  const data = outcome?.data ?? null;

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("engHome.title"), href: routes.opsEngagement() }]} title={t("eng08.title")} meta={t("eng08.meta")} locale={locale} />
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng08.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {attempt?.done === "recorded" || attempt?.done === "replay" ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast family={attempt.done === "recorded" ? "positive" : "info"} title={t(`eng08.${attempt.done}`, { event: text(params.recorded) })} locale={locale}>
              {t(`eng08.${attempt.done}Text`)}
            </Toast>
          </div>
        ) : null}
        {attempt?.refusal ? <RefusalBanner refusal={attempt.refusal} t={t} locale={locale} density="console" /> : null}
        {data !== null || view === "loading" ? <Ask data={data} participant={participant} atRaw={atRaw} t={t} locale={locale} /> : null}
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={3} density="console" locale={locale} />
          </Panel>
        ) : null}
        {data !== null && data.asked !== null ? <Resolution data={data} atRaw={atRaw} kept={attempt?.form ?? {}} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** The three inputs' first two, asked before anything resolves; the capability's state above them. */
function Ask({ data, participant, atRaw, t, locale }: { data: QualifyingActionForm | null; participant: string; atRaw: string; t: Translate; locale: Locale }) {
  const field = data?.refusal?.code === "FIELD_MISSING" ? String(data.refusal.values.field ?? "") : null;
  const parts = fieldParts(readInstant(atRaw));
  const capability = data?.capability ?? null;
  return (
    <>
      {capability?.state === "WITHHELD" ? (
        <Banner family="info" title={t("eng08.withheld")} density="console" locale={locale}>
          {t("eng08.withheldText")}
        </Banner>
      ) : null}
      {capability?.state === "SUSPENDED" ? (
        <Banner family="attention" title={t("eng.refusal.CAPABILITY_SUSPENDED.title")} density="console" locale={locale}>
          {t("eng.refusal.CAPABILITY_SUSPENDED.text")}
        </Banner>
      ) : null}
      <Panel title={t("eng08.askTitle")} level={2} density="console" locale={locale}>
        <form action={routes.opsQualifyingAction()} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <TextField
            label={t("eng08.participant")}
            helper={t("eng08.participantHelp")}
            name="participant"
            value={participant}
            mono
            required
            {...(field === "participant" ? { error: t("eng08.participantUnknown") } : {})}
            density="console"
            width="var(--container-xs)"
            locale={locale}
          />
          <DateField
            label={t("eng08.at")}
            helper={t("eng08.atHelp")}
            name="at"
            {...(parts.date !== "" ? { value: parts.date, time: parts.time } : {})}
            withTime
            required
            {...(field === "action_occurred_at" ? { error: t("eng08.atInvalid") } : {})}
            density="console"
            width="var(--container-xs)"
            locale={locale}
          />
          <ButtonRow>
            <Button type="submit" variant="secondary" size="sm" icon="search" locale={locale}>
              {t("eng08.resolve")}
            </Button>
            <Button variant="quiet" size="sm" href={routes.opsQualifyingAction()} locale={locale}>
              {t("eng08.cancel")}
            </Button>
          </ButtonRow>
        </form>
      </Panel>
    </>
  );
}

/** The resolved version and value, the code chosen from it, and Record; or the rule refusal, routed to its owner. */
function Resolution({ data, atRaw, kept, t, locale }: { data: QualifyingActionForm; atRaw: string; kept: Readonly<Record<string, string>>; t: Translate; locale: Locale }) {
  const refusal = data.refusal;
  if (refusal !== null && refusal.code === "FIELD_MISSING") return null;
  if (refusal !== null) {
    return (
      <Panel title={t("eng08.resolvedTitle")} level={2} density="console" locale={locale}>
        <RefusalBanner refusal={refusal} t={t} locale={locale} density="console" />
        <Text size="sm" tone="secondary">
          {t(refusal.code === "AWARD_RULE_WITHDRAWN" ? "eng08.routeWithdrawn" : "eng08.routeGap")}
        </Text>
      </Panel>
    );
  }
  const resolution = data.resolution;
  const participant = data.participant;
  if (resolution === null || participant === null) return null;
  const withheld = data.capability.state !== "RELEASED";
  const reason = withheld
    ? data.capability.state === "SUSPENDED"
      ? t("eng.refusal.CAPABILITY_SUSPENDED.title")
      : t("eng08.withheld")
    : resolution.codes.length === 0
      ? t("eng08.noCodes", { cls: t(`eng.class.${participant.participantClass}`) })
      : null;
  return (
    <Panel title={t("eng08.resolvedTitle")} level={2} density="console" locale={locale}>
      <FactList
        columns={2}
        density="console"
        locale={locale}
        items={[
          { label: t("eng08.fParticipant"), value: participant.name, note: participant.ref },
          { label: t("eng08.fClass"), value: t(`eng.class.${participant.participantClass}`) },
          { label: t("eng08.fVersion"), value: t("eng08.versionValue", { n: resolution.version.no, d: moment(resolution.version.effectiveFrom, locale) }) },
        ]}
      />
      <form action={recordQualifyingActionAct} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <input type="hidden" name="participant" value={participant.ref} />
        <input type="hidden" name="at" value={atRaw} />
        <Select
          label={t("eng08.code")}
          helper={t("eng08.codeHelp")}
          name="action_code"
          options={resolution.codes.map((code) => {
            const words = actionNote(code.code, t);
            const n = count(code.value, locale);
            return { value: code.code, label: words !== null ? t("eng08.codeOption", { action: words, code: code.code, n }) : t("eng08.codeOptionBare", { code: code.code, n }) };
          })}
          {...(kept.action_code !== undefined && kept.action_code !== "" ? { value: kept.action_code } : resolution.codes[0] !== undefined ? { value: resolution.codes[0].code } : {})}
          required
          density="console"
          width="var(--container-sm)"
          locale={locale}
        />
        <TextField
          label={t("eng08.subject")}
          helper={t("eng08.subjectHelp")}
          name="subject_ref"
          value={kept.subject_ref ?? ""}
          mono
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
        <Select
          label={t("eng08.profile")}
          helper={t("eng08.profileHelp")}
          name="display_profile_ref"
          options={data.profiles.map((profile) => ({ value: profile.ref, label: t("eng08.profileOption", { name: profile.name, ref: profile.ref }) }))}
          {...(kept.display_profile_ref !== undefined && kept.display_profile_ref !== "" ? { value: kept.display_profile_ref } : data.profiles[0] !== undefined ? { value: data.profiles[0].ref } : {})}
          required
          density="console"
          width="var(--container-sm)"
          locale={locale}
        />
        <Text size="sm" tone="secondary">
          {t("eng08.notChosen")}
        </Text>
        <ButtonRow>
          <Button type="submit" variant="primary" size="sm" {...(reason !== null ? { disabled: true, disabledReason: reason } : {})} locale={locale}>
            {t("eng08.record")}
          </Button>
          <Button variant="quiet" size="sm" href={routes.opsQualifyingAction()} locale={locale}>
            {t("eng08.cancel")}
          </Button>
        </ButtonRow>
      </form>
    </Panel>
  );
}

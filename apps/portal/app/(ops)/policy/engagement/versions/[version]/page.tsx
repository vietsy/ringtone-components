import { notFound } from "next/navigation";
import { Banner, Button, ButtonRow, ChoiceList, DateField, PageHeader, Panel, Select, Skeleton, Table, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { addActionAct, changeActionValueAct, removeActionAct, submitVersionAct } from "@/features/engagement/actions";
import { actionNote, count, engTranslator, fieldParts, readInstant, refusalSentence, versionStatus } from "@/features/engagement/copy";
import { PolicyTabs } from "@/features/engagement/PolicyTabs";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { RowActs } from "@/features/engagement/RowActs";
import { SubmitFor } from "@/features/engagement/SubmitFor";
import { readForPage } from "@/lib/api/flash";
import { loadRuleEditor, type EngagementAttempt, type ParticipantClass, type RuleEditorView } from "@/lib/api/engagement";
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

const CLASSES: readonly ParticipantClass[] = ["artist", "premises"];

/** Which of the editor's forms a refusal came back to, by the fields it sent. */
type Form = "submit" | "add" | "value" | null;
const formOf = (attempt: EngagementAttempt | null): Form =>
  attempt === null ? null : "participant_class" in attempt.form ? "add" : "referral" in attempt.form ? "submit" : "award_value" in attempt.form ? "value" : null;

/**
 * SCR-ENG-07 Award rule version editor. No board or Figma frame draws it: it is built from ENG's specification and
 * wireframe. The version's effective instant, with *must be in the future* beside it before submission, never a
 * default; whether a referral programme is enabled; every action with its class and value, each removable while the
 * version is PREPARED; Add an action, refused for a code already listed or a value that is not a positive whole
 * number; and Submit for approval, which returns to SCR-ENG-06. An approved version opens read-only.
 */
export default async function AwardRuleEditorPage({ params, searchParams }: { params: Promise<{ version: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS", "ACT-DPO", "ACT-AUD");
  const [{ version: raw }, query] = await Promise.all([params, searchParams]);
  const no = Number(raw);
  if (!Number.isSafeInteger(no) || no < 1) notFound();
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(query, ENG_VIEWS);
  const outcome = view === "loading" ? null : await loadRuleEditor(staff, no, view);
  const kept = readForPage<EngagementAttempt>(query);
  const attempt = kept?.page === "eng07" ? kept : null;
  const data = outcome?.data ?? null;

  return (
    <OpsFrame console="policy" current="engagement" staff={staff} searchLabel={t("engPolicy.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("eng06.title"), href: routes.policyAwardRules(no) }]}
          title={t("eng07.title", { n: no })}
          {...(data !== null ? { status: versionStatus(data.version.state, t) } : {})}
          locale={locale}
        />
        <PolicyTabs current="rules" t={t} locale={locale} />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="table" rows={3} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng07.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {data !== null ? <Editor data={data} edit={typeof query.edit === "string" ? query.edit : null} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Editor({ data, edit, attempt, t, locale }: { data: RuleEditorView; edit: string | null; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const { version } = data;
  const form = formOf(attempt);
  const refusal = attempt?.refusal ?? null;
  const code = refusal?.code ?? null;
  const field = code === "FIELD_MISSING" ? String(refusal?.values.field ?? "") : null;
  // Refusals drawn beside their field; anything else above the editor.
  const besideField = code === "AWARD_VALUE_NOT_POSITIVE" || code === "AWARD_RULE_ACTION_DUPLICATE" || code === "EFFECTIVE_FROM_IN_PAST" || (field !== null && field !== "actions");
  const editing = data.mayEdit ? (version.actions.find((action) => action.code === edit) ?? null) : null;
  const typedAt = form === "submit" ? attempt?.form.effective_from : undefined;
  const at = fieldParts(typedAt !== undefined && typedAt !== "" ? readInstant(typedAt) : version.effectiveFrom);
  const referral = form === "submit" ? attempt?.form.referral === "yes" : version.referral;
  return (
    <>
      {refusal !== null && !besideField ? <RefusalBanner refusal={refusal} t={t} locale={locale} density="console" /> : null}
      {!data.mayEdit ? (
        <Banner family={version.state === "PREPARED" ? "neutral" : "info"} title={version.state === "PREPARED" ? t("eng07.preparerOnly") : t("eng.refusal.AWARD_RULE_ALREADY_APPROVED.title")} density="console" locale={locale}>
          {version.state === "PREPARED" ? t("eng07.preparerOnlyText") : t("eng.refusal.AWARD_RULE_ALREADY_APPROVED.text")}
        </Banner>
      ) : null}
      <Panel title={t("eng07.termsTitle")} level={2} density="console" locale={locale}>
        <form id="eng07-submit" action={submitVersionAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <input type="hidden" name="version" value={version.no} />
          <DateField
            label={t("eng07.effective")}
            helper={t("eng07.effectiveHelp")}
            name="effective_from"
            {...(at.date !== "" ? { value: at.date, time: at.time } : {})}
            withTime
            required
            {...(form === "submit" && code === "EFFECTIVE_FROM_IN_PAST" ? { error: refusalSentence("EFFECTIVE_FROM_IN_PAST", t) } : {})}
            {...(form === "submit" && field === "effective_from" ? { error: t("eng07.effectiveMissing") } : {})}
            {...(!data.mayEdit ? { disabled: true, disabledReason: t("eng07.readOnly") } : {})}
            density="console"
            width="var(--container-xs)"
            locale={locale}
          />
          <ChoiceList
            legend={t("eng07.referral")}
            helper={t("eng07.referralHelp")}
            name="referral"
            layout="inline"
            options={[
              { value: "no", label: t("eng.no") },
              { value: "yes", label: t("eng.yes") },
            ]}
            value={referral ? "yes" : "no"}
            {...(!data.mayEdit ? { disabled: true, disabledReason: t("eng07.readOnly") } : {})}
            density="console"
            locale={locale}
          />
        </form>
      </Panel>
      <Panel title={t("eng07.actionsTitle")} level={2} compact density="console" locale={locale}>
        {data.mayEdit ? (
          <RowActs
            columns={[
              { key: "code", label: t("eng07.cCode"), kind: "stack" },
              { key: "cls", label: t("eng07.cClass") },
              { key: "value", label: t("eng07.cValue"), kind: "count", align: "end" },
              { key: "act", label: t("eng07.cAct"), kind: "actions" },
            ]}
            rows={version.actions.map((action) => ({
              key: action.code,
              cells: {
                _href: routes.policyAwardRuleEditor(version.no, action.code),
                ...(action.code === editing?.code ? { _selected: true } : {}),
                code: codeCell(action.code, t),
                cls: t(`eng.class.${action.participantClass}`),
                value: action.value,
              },
              act: { label: t("eng07.remove"), ariaLabel: t("eng07.removeAria", { code: action.code }), icon: "x", variant: "quiet" },
            }))}
            action={removeActionAct.bind(null, version.no)}
            caption={t("eng07.actionsTitle")}
            empty={{ variant: "governed", title: t("eng07.empty"), action: false }}
            footer={t("eng07.editHint")}
            locale={locale}
          />
        ) : (
          <Table
            columns={[
              { key: "code", label: t("eng07.cCode"), kind: "stack" },
              { key: "cls", label: t("eng07.cClass") },
              { key: "value", label: t("eng07.cValue"), kind: "count", align: "end" },
            ]}
            rows={version.actions.map((action) => ({ _key: action.code, code: codeCell(action.code, t), cls: t(`eng.class.${action.participantClass}`), value: action.value }))}
            density="console"
            caption={t("eng07.actionsTitle")}
            empty={{ variant: "governed", title: t("eng07.empty"), action: false }}
            locale={locale}
          />
        )}
        {editing !== null ? (
          <form action={changeActionValueAct} noValidate style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-3)" }}>
            <input type="hidden" name="version" value={version.no} />
            <input type="hidden" name="action_code" value={editing.code} />
            <TextField
              label={t("eng07.valueOf", { code: editing.code })}
              helper={t("eng07.valueHelp")}
              name="award_value"
              value={form === "value" ? (attempt?.form.award_value ?? "") : String(editing.value)}
              inputMode="numeric"
              mono
              required
              {...(form === "value" && code === "AWARD_VALUE_NOT_POSITIVE" ? { error: refusalSentence("AWARD_VALUE_NOT_POSITIVE", t) } : {})}
              density="console"
              width="var(--space-48)"
              locale={locale}
            />
            <Button type="submit" variant="secondary" size="sm" locale={locale}>
              {t("eng07.save")}
            </Button>
            <Button variant="quiet" size="sm" href={routes.policyAwardRuleEditor(version.no)} locale={locale}>
              {t("eng07.cancelEdit")}
            </Button>
          </form>
        ) : null}
        {data.mayEdit ? <AddAction no={version.no} attempt={form === "add" ? attempt : null} t={t} locale={locale} /> : null}
      </Panel>
      <ButtonRow align="between">
        <Button variant="secondary" size="sm" icon="arrow-left" href={routes.policyAwardRules(version.no)} locale={locale}>
          {t("eng07.back")}
        </Button>
        {data.mayEdit ? (
          <SubmitFor formId="eng07-submit" label={t("eng07.submit")} disabledReason={version.actions.length === 0 ? t("eng07.emptyReason") : null} locale={locale} />
        ) : null}
      </ButtonRow>
      {data.mayEdit ? (
        <Text size="sm" tone="secondary">
          {t("eng07.submitNote", { n: count(version.actions.length, locale) })}
        </Text>
      ) : null}
    </>
  );
}

/** Add an action: the code as the preparer types it, the class (the artist baseline by default) and a positive whole value. */
function AddAction({ no, attempt, t, locale }: { no: number; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const code = attempt?.refusal?.code ?? null;
  const field = code === "FIELD_MISSING" ? String(attempt?.refusal?.values.field ?? "") : null;
  const codeError = code === "AWARD_RULE_ACTION_DUPLICATE" ? refusalSentence(code, t) : field === "action_code" ? t("eng07.codeFormat") : null;
  return (
    <form action={addActionAct} noValidate style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-3)" }}>
      <input type="hidden" name="version" value={no} />
      <TextField
        label={t("eng07.code")}
        helper={t("eng07.codeHelp")}
        name="action_code"
        value={attempt?.form.action_code ?? ""}
        mono
        required
        {...(codeError !== null ? { error: codeError } : {})}
        density="console"
        width="var(--container-xs)"
        locale={locale}
      />
      <Select
        label={t("eng07.class")}
        name="participant_class"
        options={CLASSES.map((value) => ({ value, label: t(`eng.class.${value}`) }))}
        value={attempt?.form.participant_class ?? "artist"}
        density="console"
        width="var(--space-48)"
        locale={locale}
      />
      <TextField
        label={t("eng07.value")}
        helper={t("eng07.valueHelp")}
        name="award_value"
        value={attempt?.form.award_value ?? ""}
        inputMode="numeric"
        mono
        required
        {...(code === "AWARD_VALUE_NOT_POSITIVE" ? { error: refusalSentence(code, t) } : {})}
        density="console"
        width="var(--space-48)"
        locale={locale}
      />
      <Button type="submit" variant="secondary" size="sm" icon="plus" locale={locale}>
        {t("eng07.add")}
      </Button>
    </form>
  );
}

import { Banner, Button, ButtonRow, ChoiceList, DateField, PageHeader, Panel, Skeleton, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { recordCallerCase } from "@/features/cases/console-actions";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, one } from "@/features/cases/copy";
import { isoDate } from "@/features/cases/dates";
import { GroupChoice } from "@/features/cases/GroupChoice";
import { RequiredForm, RequiredSubmit } from "@/features/cases/RequiredForm";
import { loadCallerIntakeForm, type CallerCaseRecorded, type IntakeAttempt, type IntakeForm } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The required fields Record the case waits for, with the reason said beside it while each is empty. */
const REQUIRED = ["stakeholder_group", "matter", "raiser_contact"] as const;

/**
 * SCR-CAS-01 Raise a case, from its other entry point: the support-line agent's console (ACT-SUP), recording a case
 * for a caller. The caller says which group they are; the case goes in on that group's support line, which needs no
 * account, in the caller's words and at the contact they give. Both identities are stored - the caller as the raiser,
 * the agent beside them - and the acknowledgement goes to the caller, never only to this screen. Once recorded, the
 * page says the reference to read back.
 */
export default async function CallerCasePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-SUP");
  const params = await searchParams;
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const kept = view === null ? readForPage<IntakeAttempt | CallerCaseRecorded>(params) : null;
  const attempt = kept?.page === "raise" ? kept : null;
  const recorded = kept?.page === "recorded" ? kept : null;
  const outcome = view === "loading" ? null : await loadCallerIntakeForm(staff, one(params.group), attempt, view);
  const form = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0, maxWidth: "var(--container-3xl)" }}>
        <PageHeader
          crumbs={holds(staff, "ACT-CAS") ? [{ label: t("cas03.title"), href: routes.opsCases() }, { label: t("casNew.crumb") }] : [{ label: t("casops.crumb") }]}
          title={t("casNew.title")}
          meta={t("casNew.meta")}
          locale={locale}
        />
        {recorded !== null ? (
          <Banner
            family="positive"
            title={t("casNew.recordedTitle", { ref: recorded.reference })}
            {...(holds(staff, "ACT-CAS") ? { action: { label: t("casNew.openCase"), href: routes.opsCase(recorded.reference), variant: "secondary" as const } } : {})}
            live
            density="console"
            locale={locale}
          >
            {t(recorded.notice !== null ? "casNew.recordedText" : "casNew.recordedNoNotice", { ref: recorded.reference, contact: recorded.contact })}
          </Banner>
        ) : null}
        {form !== null && form.refusal !== null ? (
          <Banner family="attention" title={t(`cas.refusal.${form.refusal}.title`)} code={form.refusal} density="console" locale={locale}>
            {t(`casNew.refusal.${form.refusal}`)}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ConsoleFailure failure={failure} errorTitle={t("casNew.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
        ) : form === null ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={4} density="console" locale={locale} />
          </Panel>
        ) : (
          <Intake form={form} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

/** The caller's group, their words, the record and the period they name, the remedy they ask for, and how to reach them. */
function Intake({ form, t, locale }: { form: IntakeForm; t: Translate; locale: Locale }) {
  const { values, fieldErrors, formRoute } = form;
  const listed = form.groups.includes(form.group);
  const fieldError = (field: keyof typeof fieldErrors, name: string) => {
    const code = fieldErrors[field];
    return code !== undefined ? { error: t(`cas.refusal.${code}.text`, { field: t(name), list: form.remedies.map((kind) => t(`cas.remedy.${kind}`)).join(", ") }) } : {};
  };
  const groupHrefs = Object.fromEntries(form.groups.map((group) => [group, routes.opsCallerCase(group)]));
  const initiallyMissing = REQUIRED.filter((name) => (name === "stakeholder_group" ? !listed : (name === "matter" ? values.matter : values.contact).trim() === ""));
  return (
    <RequiredForm action={recordCallerCase} required={REQUIRED} initiallyMissing={initiallyMissing}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Panel title={t("casNew.who")} level={2} density="console" gap="md" locale={locale}>
          <GroupChoice
            label={t("casNew.group")}
            options={form.groups.map((group) => ({ value: group, label: t(`cas.group.${group}`) }))}
            value={listed ? form.group : ""}
            hrefs={groupHrefs}
            density="console"
            locale={locale}
          />
          {listed && formRoute === null ? (
            <Text size="sm" tone="secondary">
              {t("casNew.noLine", { group: t(`cas.group.${form.group}`) })}
            </Text>
          ) : (
            <Text size="sm" tone="secondary">
              {t("casNew.line")}
            </Text>
          )}
        </Panel>
        {formRoute !== null ? (
          <>
            <Panel title={t("casNew.what")} level={2} density="console" gap="md" locale={locale}>
              <TextField
                label={t("casNew.matter")}
                name="matter"
                value={values.matter}
                multiline
                rows={6}
                maxLength={4000}
                required
                helper={t("casNew.matterHelp")}
                {...fieldError("matter", "casNew.matterField")}
                density="console"
                locale={locale}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-sm), 1fr))", gap: "var(--space-4)", alignItems: "start" }}>
                <TextField label={t("cas04.subjectRef")} name="subject_ref" value={values.subject} mono autoComplete="off" density="console" locale={locale} />
                <DateField
                  label={t("cas04.period")}
                  range
                  fromLabel={t("cas04.from")}
                  toLabel={t("cas04.to")}
                  name="affected_period"
                  value={isoDate(values.periodFrom)}
                  to={isoDate(values.periodTo)}
                  max={form.today}
                  today={form.today}
                  {...fieldError("period", "cas04.period")}
                  density="console"
                  locale={locale}
                />
              </div>
              <ChoiceList
                legend={t("cas04.remedy")}
                name="requested_remedy_kind"
                options={form.remedies.map((kind) => ({ value: kind, label: t(`cas.remedy.${kind}`) }))}
                value={values.remedy}
                layout="inline"
                {...fieldError("remedy", "cas04.remedy")}
                density="console"
                locale={locale}
              />
            </Panel>
            <Panel title={t("casNew.reach")} level={2} density="console" gap="md" locale={locale}>
              <TextField
                label={t("casNew.contact")}
                name="raiser_contact"
                value={values.contact}
                required
                helper={t("casNew.contactWhy")}
                autoComplete="off"
                {...fieldError("contact", "casNew.contactField")}
                density="console"
                locale={locale}
              />
            </Panel>
          </>
        ) : null}
        <ButtonRow align="between">
          <Button variant="quiet" size="sm" href={routes.opsCases()} locale={locale}>
            {t("casNew.cancel")}
          </Button>
          <RequiredSubmit
            variant="primary"
            size="sm"
            blocked={!listed ? t("casNew.chooseGroup") : formRoute === null ? t("casNew.noLine", { group: t(`cas.group.${form.group}`) }) : null}
            reasons={[
              { field: "stakeholder_group", text: t("casNew.chooseGroup") },
              { field: "matter", text: t("casNew.tellMatter") },
              { field: "raiser_contact", text: t("casNew.giveContact") },
            ]}
            locale={locale}
          >
            {t("casNew.record")}
          </RequiredSubmit>
        </ButtonRow>
      </div>
    </RequiredForm>
  );
}

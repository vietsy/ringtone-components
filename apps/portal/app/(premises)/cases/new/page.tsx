import {
  Banner,
  Button,
  ButtonRow,
  ChoiceList,
  Columns,
  DateField,
  Divider,
  PageHeader,
  Panel,
  Skeleton,
  TextField,
  ViewState,
} from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { PublicShell } from "@/components/shells/PublicShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { raiseCase } from "@/features/cases/actions";
import { casTranslator, one, readerOf } from "@/features/cases/copy";
import { isoDate } from "@/features/cases/dates";
import { GroupChoice } from "@/features/cases/GroupChoice";
import { RequiredForm, RequiredSubmit } from "@/features/cases/RequiredForm";
import { loadIntakeForm, type IntakeAttempt, type IntakeForm } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { loadHelpRoutes } from "@/lib/api/public";
import { currentPrincipal, currentSession, currentWorld, type Principal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAS01_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** The required fields Raise the case waits for, with the reason said beside it while each is empty. */
const REQUIRED = ["stakeholder_group", "matter", "raiser_contact"] as const;

/**
 * SCR-CAS-01 Raise a case. Nothing here requires an account and nothing offers to create one: a signed-in
 * principal raises on their group's account route, inside their portal; anyone else says which group they are
 * and raises on the route that needs none. The case opens on SCR-CAS-02 with its reference.
 */
export default async function RaiseCasePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // No guard turns a reader away: the session only decides which route the case is raised on.
  const principal = await currentPrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = casTranslator(locale);
  const view = reviewView(params, CAS01_VIEWS);
  const last = view === null ? readForPage<IntakeAttempt>(params) : null;
  const key = principal?.sessionId ?? (await currentWorld());
  const subject = one(params.subject);
  const outcome =
    view === "loading" ? null : await loadIntakeForm(key, readerOf(principal), one(params.group), subject, last?.page === "raise" ? last : null, view);
  // A principal is answered at their account's address unless they say otherwise; anyone else types theirs.
  const email = principal !== null ? ((await currentSession())?.email ?? "") : "";
  const read = outcome?.data ?? null;
  const form = read !== null && last === null && read.values.contact === "" ? { ...read, values: { ...read.values, contact: email } } : read;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";
  const supportLine = form?.supportLine ?? (await loadHelpRoutes()).data?.find((route) => route.kind === "support_line")?.value ?? "";

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0, maxWidth: phone ? "100%" : "var(--container-3xl)" }}>
      <PageHeader
        {...(principal !== null ? { crumbs: [{ label: t("casMine.crumb"), href: routes.myCases() }] } : { size: "public" as const })}
        title={t("cas01.title")}
        meta={t(principal !== null ? "cas01.metaAccount" : "cas01.meta")}
        locale={locale}
      />

      {/* A refusal of the whole intake is said in the page header, naming the support line (convention 4). */}
      {form !== null && form.refusal !== null ? (
        <Banner family="attention" title={t(`cas.refusal.${form.refusal}.title`)} code={form.refusal} density="portal" locale={locale}>
          {t(`cas.refusal.${form.refusal}.text`, { number: supportLine })}
        </Banner>
      ) : null}

      {failure !== null && failure.code === "MATRIX_VERSION_NOT_APPROVED" ? (
        <Banner family="attention" title={t("cas.refusal.MATRIX_VERSION_NOT_APPROVED.title")} code={failure.code} density="portal" locale={locale}>
          {t("cas.refusal.MATRIX_VERSION_NOT_APPROVED.text", { number: supportLine })}
        </Banner>
      ) : failure !== null ? (
        <ViewState
          level={2}
          view="error"
          errorTitle={t("cas01.errTitle")}
          errorText={t("cas01.errText", { number: supportLine })}
          {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
          retryable={failure.retryable}
          density="portal"
          locale={locale}
        />
      ) : null}

      {view === "loading" ? (
        <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
          <Divider />
          <Skeleton variant="text" rows={3} density="portal" locale={locale} />
          <Divider />
          <Skeleton variant="facts" rows={1} density="portal" locale={locale} />
          <Divider />
          <Skeleton variant="facts" rows={1} density="portal" locale={locale} />
        </Panel>
      ) : null}

      {form !== null ? <Intake form={form} principal={principal} supportLine={supportLine} phone={phone} t={t} locale={locale} /> : null}
    </div>
  );

  if (principal === null) {
    return (
      <PublicShell fill locale={locale}>
        {body}
      </PublicShell>
    );
  }
  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={premisesNav("cases", frame, locale)} account={principal.account} locale={locale}>
      {body}
    </PortalShell>
  );
}

function Intake({
  form,
  principal,
  supportLine,
  phone,
  t,
  locale,
}: {
  form: IntakeForm;
  principal: Principal | null;
  supportLine: string;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { values, fieldErrors, formRoute } = form;
  const listed = form.groups.includes(form.group);
  const fieldError = (field: keyof typeof fieldErrors, name: string) => {
    const code = fieldErrors[field];
    return code !== undefined ? { error: t(`cas.refusal.${code}.text`, { field: t(name), list: form.remedies.map((kind) => t(`cas.remedy.${kind}`)).join(", ") }) } : {};
  };
  const groupHrefs = Object.fromEntries(form.groups.map((group) => [group, routes.raiseCase(values.subject, group)]));
  const initiallyMissing = REQUIRED.filter((name) =>
    name === "stakeholder_group" ? !listed : (name === "matter" ? values.matter : values.contact).trim() === "",
  );
  const inset = phone ? "sm" : "md";

  return (
    <RequiredForm action={raiseCase} required={REQUIRED} initiallyMissing={initiallyMissing}>
      <Panel gap="xl" inset={inset} density="portal" locale={locale}>
        {formRoute !== null ? <input type="hidden" name="intake_route_id" value={formRoute.id} /> : null}

        <Panel variant="plain" level={2} title={t("cas01.who")} density="portal" locale={locale}>
          {principal !== null ? (
            <>
              <input type="hidden" name="stakeholder_group" value={form.group} />
              <TextField
                label={t("cas01.group")}
                value={t("cas01.groupAccount", { group: t(`cas.group.${form.group}`), party: principal.party })}
                readOnly
                density="portal"
                locale={locale}
              />
              <Text size="base" tone="secondary" measure="2xl">
                {t("cas01.accountLine")}
              </Text>
            </>
          ) : (
            <>
              <div style={{ maxWidth: phone ? "100%" : "var(--container-md)" }}>
                <GroupChoice
                  label={t("cas01.group")}
                  options={form.groups.map((group) => ({ value: group, label: t(`cas.group.${group}`) }))}
                  value={listed ? form.group : ""}
                  hrefs={groupHrefs}
                  locale={locale}
                />
              </div>
              {listed && formRoute !== null ? (
                <Text size="base" tone="secondary" measure="2xl">
                  {t("cas01.noAccount")}
                </Text>
              ) : null}
              {/* The group's web form needs its account: the way in, and the route that needs none (BR-CAS-01). */}
              {listed && formRoute === null ? (
                <Banner
                  family="info"
                  title={t("cas01.accountTitle", { group: t(`cas.group.${form.group}`) })}
                  action={{ label: t("cas01.signIn"), href: routes.signIn(), variant: "secondary" }}
                  density="portal"
                  locale={locale}
                >
                  {t("cas01.accountText", { number: supportLine })}
                </Banner>
              ) : null}
            </>
          )}
        </Panel>

        {formRoute !== null ? (
          <>
            <Divider />
            <Panel variant="plain" level={2} title={t("cas01.what")} density="portal" locale={locale}>
              <TextField
                label={t("cas01.matter")}
                name="matter"
                value={values.matter}
                multiline
                rows={6}
                maxLength={4000}
                required
                helper={t("cas01.matterHint")}
                {...fieldError("matter", "cas01.matterField")}
                density="portal"
                locale={locale}
              />
              <Columns layout="halves" single={phone} gap={4}>
                <TextField
                  label={t("cas01.subject")}
                  name="subject_ref"
                  value={values.subject}
                  helper={t("cas01.subjectHint")}
                  mono
                  autoComplete="off"
                  density="portal"
                  locale={locale}
                />
                <DateField
                  label={t("cas01.period")}
                  range
                  fromLabel={t("cas01.from")}
                  toLabel={t("cas01.to")}
                  name="affected_period"
                  value={isoDate(values.periodFrom)}
                  to={isoDate(values.periodTo)}
                  max={form.today}
                  today={form.today}
                  helper={t("cas01.optional")}
                  {...fieldError("period", "cas01.period")}
                  density="portal"
                  locale={locale}
                />
              </Columns>
            </Panel>

            <Divider />
            <Panel variant="plain" level={2} title={t("cas01.asking")} density="portal" locale={locale}>
              {/* The options are the ones the chosen group's routes admit; none is hidden for any other reason. */}
              <ChoiceList
                legend={t("cas01.remedy")}
                helper={t("cas01.optional")}
                name="requested_remedy_kind"
                options={form.remedies.map((kind) => ({ value: kind, label: t(`cas.remedy.${kind}`) }))}
                value={values.remedy}
                layout={phone ? "list" : "inline"}
                {...fieldError("remedy", "cas01.remedy")}
                density="portal"
                locale={locale}
              />
            </Panel>

            <Divider />
            <Panel variant="plain" level={2} title={t("cas01.reach")} density="portal" locale={locale}>
              <div style={{ maxWidth: phone ? "100%" : "var(--container-md)" }}>
                {/* The sentence under the field is a specified element: why a contact is asked for. */}
                <TextField
                  label={t("cas01.contact")}
                  name="raiser_contact"
                  value={values.contact}
                  required
                  helper={t("cas01.contactWhy")}
                  autoComplete="email"
                  {...fieldError("contact", "cas01.contactField")}
                  density="portal"
                  locale={locale}
                />
              </div>
            </Panel>
          </>
        ) : null}

        <ButtonRow align="between">
          <Button variant="quiet" size="md" href={principal !== null ? routes.myCases() : routes.home()} fullWidth={phone} locale={locale}>
            {t("cas01.cancel")}
          </Button>
          <RequiredSubmit
            variant="primary"
            size="md"
            loadingLabel={t("cas01.raising")}
            fullWidth={phone}
            blocked={!listed ? t("cas01.chooseGroup") : formRoute === null ? t("cas01.needsAccount") : null}
            reasons={[
              { field: "stakeholder_group", text: t("cas01.chooseGroup") },
              { field: "matter", text: t("cas01.tellMatter") },
              { field: "raiser_contact", text: t("cas01.giveContact") },
            ]}
            locale={locale}
          >
            {t("cas01.raise")}
          </RequiredSubmit>
        </ButtonRow>
      </Panel>
    </RequiredForm>
  );
}

import { Banner, PageHeader, Panel, Skeleton, StatusLine } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { WithdrawalFields } from "@/features/registration/WithdrawalFields";
import { codeStatus, day, moment, refusal, regOpsTranslator, reviewTypeWords } from "@/features/registration/console-copy";
import { withdrawOnInstruction } from "@/features/registration/review-actions";
import { readForPage } from "@/lib/api/flash";
import { loadWithdrawalForm, type WithdrawalAttempt, type WithdrawalForm } from "@/lib/api/registration-review";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG15_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "withdrawal";

/**
 * SCR-REG-15 Record a withdrawal on instruction. The officer records that the applicant asked for its application
 * to be withdrawn, with the reference of that instruction, and sees what the withdrawal closes: a request still
 * open, and an adverse proposal still waiting, which closes unissued and stands beside the withdrawal in the
 * outcomes report, so a withdrawal never hides a refusal.
 */
export default async function WithdrawalPage({ params, searchParams }: { params: Promise<{ application: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const [{ application }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG15_VIEWS);
  const outcome = asked === "loading" ? null : await loadWithdrawalForm(staff, application, reviewViewOf("15", asked));
  const form = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const last = readForPage<WithdrawalAttempt>(query);
  const attempt = last?.page === "withdrawal" && last.application === application ? last : null;
  // A refusal of the state or the reader's authority sits in the page header, the control held with it.
  const head = attempt !== null && attempt.code !== "WITHDRAWAL_INSTRUCTION_REQUIRED" ? attempt.code : (form?.blocked ?? null);

  return (
    <OpsFrame console="operations" current="registration" staff={staff} searchLabel={t("regops.search")} keyMap={[{ keys: ["Esc"], label: t("regops.keyEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("regops.area") },
            { label: t("regops.queue"), href: routes.opsRegistration() },
            { label: t("regops.caseFile", { r: application }), href: routes.opsApplication(application) },
          ]}
          title={form !== null ? t("reg15.title", { r: form.reference }) : t("reg15.titleGeneric")}
          {...(form !== null ? { status: codeStatus(form.status), meta: meta(form, t, locale) } : {})}
          locale={locale}
        />
        {head !== null && form !== null ? (
          <Banner family="attention" title={refusal(t, head, "reg15").title} code={head} density="console" live locale={locale}>
            {refusal(t, head, "reg15").text}
          </Banner>
        ) : null}
        {asked === "loading" ? (
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <Panel>
              <Skeleton variant="card" rows={5} density="console" />
            </Panel>
          </div>
        ) : null}
        {failure !== null ? <ConsoleFailure failure={failure} screen="reg15" t={t} locale={locale} /> : null}
        {form !== null ? (
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <form id={FORM} action={withdrawOnInstruction.bind(null, form.reference)} noValidate>
              <WithdrawalFields
                formId={FORM}
                words={{
                  instruction: t("reg15.instruction"),
                  ref: t("reg15.ref"),
                  refHelp: t("reg15.refHelp"),
                  reason: t("reg15.reason"),
                  reasonHelp: t("reg15.reasonHelp"),
                  record: t("reg15.record"),
                  recordWhy: t("reg15.recordWhy"),
                  cancel: t("regops.cancel"),
                  dlgTitle: t("reg15.dlgTitle", { r: form.reference, i: "{i}" }),
                  dlgText: form.pendingAdverse !== null ? `${t("reg15.dlgText")} ${t("reg15.dlgProposal")}` : t("reg15.dlgText"),
                  dlgBack: t("regops.back"),
                }}
                initial={attempt?.values ?? { instruction: "", reason: "" }}
                refError={attempt?.code === "WITHDRAWAL_INSTRUCTION_REQUIRED" ? refusal(t, attempt.code).text : null}
                heldBy={form.blocked === null ? null : form.blocked === "APPLICATION_ALREADY_FINAL" ? t("reg15.finalWhy") : t("reg15.naWhy")}
                records={<Records form={form} t={t} locale={locale} />}
                cancelHref={routes.opsApplication(form.reference)}
                locale={locale}
              />
            </form>
          </div>
        ) : null}
      </div>
    </OpsFrame>
  );
}

function meta(form: WithdrawalForm, t: Translate, locale: Locale): string {
  const type = reviewTypeWords(form.reviewType, t);
  return form.completeOn !== null && form.expectedOn !== null
    ? t("reg15.meta", { p: form.premises.name, type, c: day(form.completeOn, locale), e: day(form.expectedOn, locale) })
    : t("reg15.metaPlain", { p: form.premises.name, type });
}

/** What the withdrawal records: the application withdrawn, an open request ended, a waiting proposal closed unissued. */
function Records({ form, t, locale }: { form: WithdrawalForm; t: Translate; locale: Locale }) {
  return (
    <Panel variant="plain" level={2} title={t("reg15.records")} compact locale={locale}>
      <Text size="sm">{t("reg15.withdrawn")}</Text>
      {form.openRequest ? <Text size="sm">{t("reg15.requestEnds")}</Text> : null}
      {form.pendingAdverse !== null ? (
        <StatusLine
          family="attention"
          text={t(`reg15.proposalLine.${form.pendingAdverse.outcome}`, { at: moment(form.pendingAdverse.since, locale) })}
          detail={t("reg15.proposalDetail")}
          cutout="surface"
          locale={locale}
        />
      ) : null}
    </Panel>
  );
}

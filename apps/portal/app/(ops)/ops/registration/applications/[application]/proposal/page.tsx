import { PageHeader, Panel, Skeleton } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { ProposalFields } from "@/features/registration/ProposalFields";
import { codeStatus, day, money, reasonWords, refusal, regOpsTranslator, reviewTypeWords } from "@/features/registration/console-copy";
import { proposeDecision } from "@/features/registration/review-actions";
import { readForPage } from "@/lib/api/flash";
import { loadProposalForm, type ProposalAttempt, type ProposalForm } from "@/lib/api/registration-review";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PROPOSAL_REASONS, REG13_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "decision-proposal";
const OUTCOMES = ["DECIDED_AS_APPLIED", "DECIDED_OTHERWISE", "REFUSED"] as const;

/**
 * SCR-REG-13 Decision proposal. The officer prepares the outcome of an application in review and the statement the
 * applicant receives: issued at once when it is as applied for, or sent for approval when it refuses or decides
 * otherwise. Refusals of the statement sit beside it; the others above the action row, with the values kept.
 */
export default async function DecisionProposalPage({ params, searchParams }: { params: Promise<{ application: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const [{ application }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG13_VIEWS);
  const outcome = asked === "loading" ? null : await loadProposalForm(staff, application, reviewViewOf("13", asked));
  const form = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const last = readForPage<ProposalAttempt>(query);
  const attempt = last?.page === "proposal" && last.application === application ? last : null;

  return (
    <OpsFrame console="operations" current="registration" staff={staff} searchLabel={t("regops.search")} keyMap={[{ keys: ["Esc"], label: t("regops.keyEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("regops.area") },
            { label: t("regops.queue"), href: routes.opsRegistration() },
            { label: t("regops.caseFile", { r: application }), href: routes.opsApplication(application) },
          ]}
          title={form !== null ? t("reg13.title", { r: form.reference }) : t("reg13.titleGeneric")}
          {...(form !== null ? { status: codeStatus(form.status), meta: meta(form, t) } : {})}
          locale={locale}
        />
        {asked === "loading" ? (
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <Panel>
              <Skeleton variant="card" rows={8} density="console" />
            </Panel>
          </div>
        ) : null}
        {failure !== null ? <ConsoleFailure failure={failure} screen="reg13" t={t} locale={locale} /> : null}
        {form !== null ? <Proposal form={form} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function meta(form: ProposalForm, t: Translate): string {
  if (form.amends !== null) return t("reg13.metaAmend", { p: form.premises.name, o: form.amends.decision, rb: form.rulebook });
  return t("reg13.meta", { p: form.premises.name, kind: form.kind, type: reviewTypeWords(form.reviewType, t), rb: form.rulebook });
}

/** The codes said beside the statement or Effective from; any other is said above the action row. */
const STATEMENT_CODES: readonly string[] = ["STATEMENT_INCOMPLETE"];
const EFFECTIVE_CODES: readonly string[] = ["PRE_REGISTRATION_OBLIGATION_RESERVED"];

function Proposal({ form, attempt, t, locale }: { form: ProposalForm; attempt: ProposalAttempt | null; t: Translate; locale: Locale }) {
  const fee = (amount: number | null) => (amount !== null ? money(amount, form.fees.currency, locale) : null);
  const dates = form.dates;
  const after = dates.toldOn !== null;
  const code = attempt !== null && !STATEMENT_CODES.includes(attempt.code) && !EFFECTIVE_CODES.includes(attempt.code) ? attempt.code : form.blocked !== "DRAFT" ? form.blocked : null;
  const shown = code !== null ? refusal(t, code, "reg13") : null;
  return (
    <div style={{ maxWidth: "var(--container-3xl)" }}>
      <form id={FORM} action={proposeDecision.bind(null, form.reference)} noValidate>
        <ProposalFields
          formId={FORM}
          words={{
            proposed: t("reg13.proposed"),
            outcomes: OUTCOMES.map((value) => ({ value, label: t(`reg13.o.${value}`) })),
            needsApproval: t("reg13.needsApproval"),
            noApproval: t("reg13.noApproval"),
            effective: t("reg13.effective"),
            effectiveHelp: form.amends !== null ? t("reg13.effectiveHelp", { d: day(form.amends.registeredOn, locale) }) : "",
            fee: t("reg13.fee"),
            feeNote: t("reg13.feeNote", { v: form.fees.tariffVersion }),
            feeNone: t("reg13.feeNone"),
            feeUnknown: t("reg13.feeUnknown"),
            statement: t("reg13.statement"),
            statementNote: t("reg13.statementNote"),
            reason: t("reg13.reason"),
            reasonPick: t("reg13.reasonPick"),
            reasonHelp: t("reg13.reasonHelp", { rb: form.rulebook }),
            reasons: PROPOSAL_REASONS.map((value) => ({ value, label: reasonWords(value, locale) })),
            outcomeText: t("reg13.outcomeText"),
            outcomeHelp: t("reg13.outcomeHelp"),
            notMet: t("reg13.notMet"),
            notMetHelp: t("reg13.notMetHelp"),
            addCondition: t("reg13.addCondition"),
            conditionTitle: t("reg13.conditionTitle", { n: "{n}" }),
            condition: t("reg13.condition"),
            canDo: t("reg13.canDo"),
            canDoHelp: t("reg13.canDoHelp"),
            appeal: t("reg13.appeal"),
            appealValue: t("reg13.appealVal", { v: String(form.explanationVersion) }),
            send: t("reg13.send"),
            issue: t("reg13.issue"),
            sendWhy: t("reg13.sendWhy"),
            cancel: t("regops.cancel"),
            sendTitle: t("reg13.sendTitle"),
            sendText: t("reg13.sendText", { r: form.reference }),
            issueTitle: t("reg13.issueTitle", { p: form.premises.name }),
            issueText: t("reg13.issueText"),
            back: t("regops.back"),
          }}
          initial={
            attempt !== null
              ? attempt.values
              : { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: "" }
          }
          fees={{ asApplied: fee(form.fees.asApplied), otherwise: fee(form.fees.otherwise) }}
          amends={form.amends !== null ? { registeredOn: form.amends.registeredOn } : null}
          fieldErrors={{
            statement: attempt !== null && STATEMENT_CODES.includes(attempt.code) ? refusal(t, attempt.code).text : null,
            effective: attempt !== null && EFFECTIVE_CODES.includes(attempt.code) ? refusal(t, attempt.code).text : null,
          }}
          dates={{
            title: t("reg13.dates"),
            items: [
              { label: t("reg13.complete"), value: dates.completeOn, kind: "date" },
              { label: t("reg13.expected"), value: dates.expectedOn, kind: "date" },
              { label: t("reg13.deadline"), value: dates.deadline, kind: "date" },
            ],
            after: after && dates.toldOn !== null ? { text: t("reg13.afterLine"), detail: t("reg13.told", { d: day(dates.toldOn, locale) }) } : null,
          }}
          banner={
            shown !== null
              ? {
                  family: code === "TARIFF_NOT_APPROVED" ? "neutral" : "attention",
                  title: shown.title,
                  code: shown.code,
                  text:
                    attempt?.governingDecision !== null && attempt?.governingDecision !== undefined
                      ? `${shown.text} ${t("reg13.governing", { o: attempt.governingDecision })}`
                      : shown.text,
                }
              : null
          }
          cancelHref={routes.opsApplication(form.reference)}
          locale={locale}
        />
      </form>
    </div>
  );
}

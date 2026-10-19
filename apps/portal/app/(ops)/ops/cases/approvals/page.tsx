import { Button, PageHeader, Panel, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, moment } from "@/features/cases/copy";
import { loadApprovals } from "@/lib/api/cases";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** An appeal or a reopening still waiting is attention; one decided or lapsed is a fact. */
const OPEN_FAMILY = { UNDER_APPEAL: "attention", APPEAL_DECIDED: "neutral", APPEAL_LAPSED: "attention", REOPEN_PROPOSED: "attention", REOPENED: "neutral", REOPEN_REFUSED: "neutral" } as const;

/**
 * The approvals surface's queue, the dispute authority's landing in the case workspace: the appeals to decide
 * (SCR-CAS-09) and the reopenings to authorise (SCR-CAS-15), the open ones first. A case officer does not navigate
 * here: an appeal is reached from this queue, which is the interface half of the separation BR-CAS-08 requires.
 */
export default async function CaseApprovalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DSP");
  const params = await searchParams;
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const outcome = view === "loading" ? null : await loadApprovals(staff, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="cases"
      staff={staff}
      searchLabel={t("casops.search")}
      keyMap={[
        { keys: ["J", "K"], label: t("cas03.kMove") },
        { keys: ["Enter"], label: t("casAp.kOpen") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("casops.crumb") }]} title={t("casAp.title")} {...(data !== null ? { meta: t("cas03.meta", { t: moment(data.asOf, locale) }) } : {})} locale={locale}>
          {holds(staff, "ACT-BIZ-APR") ? (
            <>
              <Button variant="secondary" size="sm" href={routes.opsIntakeMatrix()} locale={locale}>
                {t("cas03.matrix")}
              </Button>
              <Button variant="secondary" size="sm" href={routes.opsCasePolicy()} locale={locale}>
                {t("cas03.policy")}
              </Button>
            </>
          ) : null}
        </PageHeader>
        {failure !== null ? (
          <ConsoleFailure failure={failure} errorTitle={t("casAp.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
        ) : (
          <>
            <Panel title={t("casAp.appeals")} level={2} density="console" locale={locale}>
              <Table
                columns={[
                  { key: "ref", label: t("casAp.cAppeal"), kind: "id" },
                  { key: "case", label: t("cas03.cRef"), kind: "mono" },
                  { key: "received", label: t("casAp.cReceived"), kind: "datetime" },
                  { key: "due", label: t("casAp.cDue"), kind: "stack" },
                  { key: "state", label: t("cas03.cState"), kind: "status" },
                ]}
                rows={(data?.appeals ?? []).map((appeal) => ({
                  _key: appeal.reference,
                  _href: routes.opsAppeal(appeal.reference),
                  ref: appeal.reference,
                  case: appeal.caseReference,
                  received: appeal.receivedAt,
                  due: { text: appeal.dueAt !== null ? day(appeal.dueAt, locale) : t("casAp.unmeasured"), ...(appeal.late ? { detail: t("casAp.late") } : {}) },
                  state: { family: OPEN_FAMILY[appeal.state], label: appeal.state, quiet: true },
                }))}
                rowFocus
                loading={data === null ? 3 : false}
                empty={{ variant: "governed", title: t("casAp.noAppeals"), text: t("casAp.noAppealsText"), action: false }}
                density="console"
                caption={t("casAp.appeals")}
                locale={locale}
              />
            </Panel>
            <Panel title={t("casAp.reopenings")} level={2} density="console" locale={locale}>
              <Table
                columns={[
                  { key: "ref", label: t("casAp.cReopening"), kind: "id" },
                  { key: "case", label: t("cas03.cRef"), kind: "mono" },
                  { key: "ground", label: t("casAp.cGround") },
                  { key: "by", label: t("casAp.cProposer") },
                  { key: "proposed", label: t("casAp.cProposed"), kind: "datetime" },
                  { key: "state", label: t("cas03.cState"), kind: "status" },
                ]}
                rows={(data?.reopenings ?? []).map((entry) => ({
                  _key: entry.reference,
                  _href: routes.opsCaseReopening(entry.caseReference),
                  ref: entry.reference,
                  case: entry.caseReference,
                  ground: t(`casops.groundKind.${entry.groundKind}`),
                  by: t(`casAp.proposer.${entry.proposer}`),
                  proposed: entry.proposedAt,
                  state: { family: OPEN_FAMILY[entry.state], label: entry.state, quiet: true },
                }))}
                loading={data === null ? 3 : false}
                empty={{ variant: "governed", title: t("casAp.noReopenings"), text: t("casAp.noReopeningsText"), action: false }}
                density="console"
                caption={t("casAp.reopenings")}
                locale={locale}
              />
            </Panel>
          </>
        )}
      </div>
    </OpsFrame>
  );
}

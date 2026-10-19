import { redirect } from "next/navigation";
import { Banner, Button, PageHeader, Pagination, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { ANY, QueueFilter } from "@/features/registration/QueueFilter";
import { codeStatus, count, day, moment, refusal, regOpsTranslator, reviewTypeWords, shortDay } from "@/features/registration/console-copy";
import { REVIEW_STATES, REVIEW_TYPES, loadReviewQueue, type QueueRow, type ReviewQueue } from "@/lib/api/registration-review";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG09_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/** The skeleton's rows: twenty at 1280 (the list definition's density). */
const LOADING_ROWS = 20;

/**
 * SCR-REG-09 Review queue, the registration workspace's landing. Every application in review by queue, state and
 * premises, the oldest complete first, with its expected decision date and the payment deadline beside it; a row
 * opens its case file. The workspace opens for other registration roles too, and each lands where its role works:
 * the business approver on its approvals, the reporting and data readers on the reporting surface.
 */
export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-BIZ-APR", "ACT-REP", "ACT-DAT");
  if (!holds(staff, "ACT-OPS")) {
    if (holds(staff, "ACT-BIZ-APR")) redirect(routes.opsApprovals());
    redirect(holds(staff, "ACT-REP") ? routes.opsRegistrationReports() : routes.opsUseStarts());
  }
  const params = await searchParams;
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(params, REG09_VIEWS);
  const filter = { queue: text(params.queue), status: text(params.status), premises: text(params.premises) };
  const outcome = asked === "loading" ? null : await loadReviewQueue(staff, filter, text(params.cursor), reviewViewOf("09", asked));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const cursorInvalid = failure?.code === "CURSOR_INVALID";

  return (
    <OpsFrame
      console="operations"
      current="registration"
      staff={staff}
      searchLabel={t("regops.search")}
      keyMap={[
        { keys: ["J", "K"], label: t("regops.keyMove") },
        { keys: ["Enter"], label: t("reg09.kOpen") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("regops.crumb") }]}
          title={t("reg09.title")}
          {...(data !== null ? { meta: t("reg09.meta", { ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          <Button variant="secondary" size="sm" icon="refresh-cw" href={routes.opsRegistration(filter)} locale={locale}>
            {t("regops.reload")}
          </Button>
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("regops.close")}
          </Button>
        </PageHeader>
        <QueueFilter
          words={{ filters: t("reg09.filters"), queue: t("reg09.fQueue"), state: t("reg09.fState"), premises: t("reg09.fPremises"), anyPremises: t("reg09.anyPremises") }}
          queues={[{ value: ANY, label: t("reg09.allQueues") }, ...REVIEW_TYPES.map((type) => ({ value: type, label: t(`reg09.q.${type}`) }))]}
          states={[{ value: ANY, label: t("reg09.allStates") }, ...REVIEW_STATES.map((state) => ({ value: state, label: state }))]}
          premises={(data?.premisesOptions ?? []).map((premises) => ({ value: premises.id, label: premises.name }))}
          value={data?.filter ?? { queue: filter.queue, status: filter.status, premises: filter.premises }}
          summary={data !== null ? t("reg09.count", { n: count(data.total, locale) }) : ""}
          locale={locale}
        />
        {cursorInvalid ? (
          <Banner
            family="attention"
            title={refusal(t, "CURSOR_INVALID").title}
            code="CURSOR_INVALID"
            action={{ label: t("reg09.reloadFirst"), icon: "refresh-cw", variant: "secondary", href: routes.opsRegistration() }}
            density="console"
            locale={locale}
          >
            {refusal(t, "CURSOR_INVALID").text}
          </Banner>
        ) : failure !== null ? (
          <ConsoleFailure failure={failure} t={t} locale={locale} />
        ) : (
          <Queue data={data} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Queue({ data, t, locale }: { data: ReviewQueue | null; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const filtered = data !== null && (data.filter.queue !== null || data.filter.status !== null || data.filter.premises !== null);
  return (
    <>
      <Table
        columns={[
          { key: "ref", label: t("reg09.cRef"), kind: "id" },
          { key: "prem", label: t("reg09.cPremises"), minWidth: "var(--space-48)" },
          { key: "type", label: t("reg09.cType") },
          { key: "st", label: t("reg09.cState"), kind: "status" },
          { key: "complete", label: t("reg09.cComplete"), kind: "date", short: true, missing: t("reg09.noDate") },
          { key: "expected", label: t("reg09.cExpected"), kind: "stack", detailSize: "sm", minWidth: "var(--space-32)", missing: t("reg09.noExpected") },
          { key: "deadline", label: t("reg09.cDeadline"), kind: "date", short: true, help: t("reg09.deadlineHelp"), missing: t("reg09.noDate") },
        ]}
        rows={rows.map((row) => queueRow(row, t, locale))}
        density="console"
        rowFocus
        {...(rows.length > 0 ? { sortNote: t("reg09.sortNote") } : {})}
        loading={data === null ? LOADING_ROWS : false}
        empty={{ variant: "filtered", title: t("reg09.emptyTitle"), text: t("reg09.emptyText"), action: false }}
        caption={t("reg09.title")}
        locale={locale}
      />
      {data !== null && rows.length > 0 ? (
        <Pagination
          summary={t("reg09.pager", { a: count(data.offset + 1, locale), b: count(data.offset + rows.length, locale), n: count(data.total, locale) })}
          hasNext={data.nextCursor !== null}
          {...(data.nextCursor !== null ? { nextHref: routes.opsRegistration({ ...data.filter, position: data.nextCursor }) } : {})}
          {...(data.offset > 0 ? { firstHref: routes.opsRegistration(data.filter) } : {})}
          endNote={data.nextCursor === null ? t(filtered ? "reg09.endFiltered" : "reg09.endAll") : false}
          density="console"
          label={t("reg09.pages")}
          locale={locale}
        />
      ) : null}
    </>
  );
}

/** One application in review; a row past its expected date takes the tint, and the risk to the deadline goes under it. */
function queueRow(row: QueueRow, t: Translate, locale: Locale): Record<string, unknown> {
  const detail = row.pastExpected ? t("reg09.past") : row.restatedOnAnswer ? t("reg09.restated") : null;
  const message =
    row.reviewType === null
      ? { severity: "info", text: t("reg09.auto") }
      : row.risk?.kind === "TOLD"
        ? { severity: "warning", text: t("reg09.risk", { d: day(row.risk.toldOn, locale) }) }
        : row.risk?.kind === "PASSED"
          ? { severity: "warning", text: t("reg09.riskPassed") }
          : null;
  return {
    _key: row.reference,
    _href: routes.opsApplication(row.reference),
    ...(row.pastExpected ? { _tone: "attention" } : {}),
    ...(message !== null ? { _message: message } : {}),
    ref: row.reference,
    prem: row.premises.name,
    type: reviewTypeWords(row.reviewType, t),
    st: codeStatus(row.status, true),
    complete: row.completeOn,
    expected: row.expectedOn !== null ? { text: shortDay(row.expectedOn, locale), ...(detail !== null ? { detail } : {}) } : null,
    deadline: row.deadline,
  };
}

import {
  ApprovalPair,
  Banner,
  Columns,
  Divider,
  FactList,
  PageHeader,
  Pagination,
  Panel,
  Skeleton,
  StatusLine,
  Table,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { VerdictFields } from "@/features/registration/VerdictFields";
import { codeStatus, count, money, moment, reasonWords, refusal, regOpsTranslator } from "@/features/registration/console-copy";
import { recordVerdict } from "@/features/registration/review-actions";
import { readForPage } from "@/lib/api/flash";
import { loadApprovals, type Approvals, type ProposalDetail, type VerdictAttempt } from "@/lib/api/registration-review";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG14_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "verdict";
/** Refusals said beside the note, or by the pair of names; any other sits above the verdict controls. */
const IN_PLACE: readonly string[] = ["VERDICT_NOTE_REQUIRED", "SEGREGATION_REQUIRED"];

/**
 * SCR-REG-14 Approve or return a proposal. The proposals waiting for the reader's approval, oldest first and
 * without those the reader prepared; the one opened, from the list or a link, with its statement and fee; and the
 * verdict. The officer who prepared a proposal may open it and is refused SEGREGATION_REQUIRED, the controls
 * unavailable with the reason (SEC-286); an approval issues the outcome at once.
 */
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-BIZ-APR", "ACT-OPS");
  const query = await searchParams;
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG14_VIEWS);
  const proposal = typeof query.proposal === "string" && query.proposal !== "" ? query.proposal : null;
  const outcome = asked === "loading" ? null : await loadApprovals(staff, proposal, reviewViewOf("14", asked));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const last = readForPage<VerdictAttempt>(query);
  const attempt = last?.page === "verdict" && last.proposal === proposal ? last : null;
  const opened = data?.opened?.data ?? null;

  return (
    <OpsFrame
      console="operations"
      current="registration"
      staff={staff}
      searchLabel={t("regops.search")}
      keyMap={[
        { keys: ["J", "K"], label: t("regops.keyMove") },
        { keys: ["Enter"], label: t("reg14.keyOpen") },
        { keys: ["Esc"], label: t("regops.keyEsc") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("regops.area") }]}
          title={opened !== null ? t("reg14.title", { r: opened.reference }) : t("reg14.titlePlain")}
          {...(data !== null ? { meta: t("reg14.meta", { u: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        {failure !== null ? <ConsoleFailure failure={failure} screen="reg14" t={t} locale={locale} /> : <Awaiting data={data} t={t} locale={locale} />}
        {asked === "loading" ? (
          <Columns side="md">
            <Panel>
              <Skeleton variant="facts" rows={8} density="console" />
            </Panel>
            <Panel>
              <Skeleton variant="card" rows={4} density="console" />
            </Panel>
          </Columns>
        ) : null}
        {data?.opened !== null && data?.opened !== undefined && data.opened.failure !== null ? (
          <Panel compact locale={locale}>
            <ConsoleFailure failure={data.opened.failure} screen="reg14" level={3} t={t} locale={locale} />
          </Panel>
        ) : null}
        {opened !== null ? <Opened detail={opened} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Awaiting({ data, t, locale }: { data: Approvals | null; t: Translate; locale: Locale }) {
  const rows = data?.awaiting ?? [];
  const opened = data?.opened?.data?.proposal.id ?? null;
  return (
    <Panel title={t("reg14.listTitle")} compact locale={locale}>
      <Table
        columns={[
          { key: "ref", label: t("reg14.cRef"), kind: "id" },
          { key: "prem", label: t("reg14.cPrem"), kind: "stack" },
          { key: "out", label: t("reg14.cOut"), kind: "mono", nowrap: true },
          { key: "since", label: t("reg14.cSince"), kind: "datetime", nowrap: true },
        ]}
        rows={rows.map((row) => ({
          _key: row.proposal,
          _href: routes.opsApprovals(row.proposal),
          ...(row.proposal === opened ? { _selected: true } : {}),
          ref: row.reference,
          prem: { text: row.premises.name, detail: t("reg14.preparedBy", { n: row.preparedBy }) },
          out: row.outcome,
          since: row.preparedAt,
        }))}
        density="console"
        rowFocus
        loading={data === null ? 2 : false}
        empty={{ variant: "governed", title: t("reg14.emptyTitle"), action: false }}
        footer={t("reg14.notListed")}
        caption={t("reg14.listTitle")}
        locale={locale}
      />
      {rows.length > 0 ? (
        <Pagination
          summary={rows.length === 1 ? t("reg14.pagerOne") : t("reg14.pager", { n: count(rows.length, locale) })}
          hasNext={false}
          endNote={t("reg14.endNote")}
          density="console"
          label={t("reg14.listTitle")}
          locale={locale}
        />
      ) : null}
    </Panel>
  );
}

function Opened({ detail, attempt, t, locale }: { detail: ProposalDetail; attempt: VerdictAttempt | null; t: Translate; locale: Locale }) {
  const proposal = detail.proposal;
  const adverse = proposal.outcome !== "DECIDED_AS_APPLIED";
  const pending = proposal.status === "PENDING_APPROVAL";
  const verdict = proposal.verdict;
  const feeFact =
    proposal.feeMinor !== null
      ? { label: t("reg14.feeLabel"), value: { amountMinor: proposal.feeMinor, currency: proposal.currency }, kind: "money" as const, ...(proposal.tariffVersion !== null ? { note: t("reg14.feeNote", { v: proposal.tariffVersion }) } : {}) }
      : { label: t("reg14.feeLabel"), value: null, kind: "money" as const, missing: proposal.outcome === "REFUSED" ? t("reg14.feeNone") : t("reg14.feeUnknown") };
  // The reader who prepared it, or one without the approver's authority, sees the controls held with the reason.
  const heldBy = detail.readerIsPreparer ? t("reg14.mine") : !detail.readerMayDecide ? t("reg14.naWhy") : null;
  const blocked = attempt !== null && !IN_PLACE.includes(attempt.code) ? attempt.code : pending && !detail.readerIsPreparer && !detail.readerMayDecide ? "NOT_AUTHORISED" : null;
  const outcomeWords = t(`reg13.o.${proposal.outcome}`);
  return (
    <Columns side="md">
      <Panel title={detail.premises.name} status={codeStatus(proposal.status)} {...(!detail.fromList ? { description: t("reg14.opened") } : {})} gap="xl" locale={locale}>
        <FactList
          items={[
            { label: t("reg14.hOut"), value: proposal.outcome, kind: "mono" },
            { label: t("reg14.hBy"), value: proposal.preparedBy.position },
            { label: t("reg14.hAt"), value: proposal.preparedAt, kind: "datetime" },
          ]}
          density="console"
          locale={locale}
        />
        {adverse ? (
          <>
            <Divider />
            <Panel variant="plain" level={3} title={t("reg14.statement")} compact locale={locale}>
              <FactList
                items={[
                  { label: t("reg14.sReason"), value: reasonWords(proposal.reason, locale) },
                  { label: t("reg14.sText"), value: proposal.text ?? "" },
                  { label: t("reg14.sUnmet"), value: proposal.unmet.join(" ") },
                  { label: t("reg14.sCan"), value: proposal.actionOpen ?? "" },
                  { label: t("reg14.sAppeal"), value: t("reg14.appealVal", { v: String(detail.explanationVersion) }) },
                ]}
                density="console"
                locale={locale}
              />
            </Panel>
          </>
        ) : null}
        <Divider />
        <Panel variant="plain" level={3} title={t("reg14.fee")} compact locale={locale}>
          <FactList items={[feeFact]} density="console" locale={locale} />
        </Panel>
      </Panel>
      <Panel title={t("reg14.verdict")} compact locale={locale}>
        {proposal.status !== "CLOSED_BY_WITHDRAWAL" ? (
          <ApprovalPair
            preparer={{ name: proposal.preparedBy.name, role: proposal.preparedBy.position, at: proposal.preparedAt }}
            approver={verdict !== null ? { name: verdict.by, role: verdict.position, at: verdict.at } : null}
            awaiting={detail.readerIsPreparer ? t("reg14.waitOther") : detail.readerMayDecide ? t("reg14.waitYou") : t("reg14.waitApprover")}
            {...(proposal.status === "APPROVED" ? { decision: "approved" as const } : proposal.status === "RETURNED" ? { decision: "returned" as const } : {})}
            {...(verdict?.note !== null && verdict?.note !== undefined ? { comment: verdict.note } : {})}
            {...(pending && detail.readerIsPreparer ? { sameActor: { code: "SEGREGATION_REQUIRED", text: refusal(t, "SEGREGATION_REQUIRED").text, family: "attention" as const } } : {})}
            locale={locale}
          />
        ) : null}
        {blocked !== null ? (
          <Banner
            family={blocked === "TARIFF_NOT_APPROVED" ? "neutral" : "attention"}
            title={refusal(t, blocked, "reg14").title}
            code={blocked}
            {...(blocked === "PROPOSAL_NOT_PENDING" ? { action: { label: t("reg14.reloadProposal"), href: routes.opsApprovals(proposal.id), variant: "secondary" as const } } : {})}
            compact
            density="console"
            live
            locale={locale}
          >
            {attempt?.governingDecision !== null && attempt?.governingDecision !== undefined
              ? `${refusal(t, blocked).text} ${t("reg13.governing", { o: attempt.governingDecision })}`
              : refusal(t, blocked).text}
          </Banner>
        ) : null}
        {pending ? (
          <form id={FORM} action={recordVerdict.bind(null, proposal.id)} noValidate style={{ display: "contents" }}>
            <VerdictFields
              formId={FORM}
              words={{
                note: t("reg14.note"),
                noteHelp: t("reg14.noteHelp"),
                approve: t("reg14.approve"),
                ret: t("reg14.ret"),
                noteFirst: t("reg14.noteFirst"),
                approveTitle: t("reg14.dlgTitle", { o: outcomeWords, p: detail.premises.name }),
                approveText: t("reg14.dlgText"),
                approveConfirm: t("reg14.dlgYes"),
                returnTitle: t("reg14.retTitle"),
                returnText: t("reg14.retText"),
                back: t("regops.back"),
              }}
              initialNote={attempt?.note ?? ""}
              noteError={attempt?.code === "VERDICT_NOTE_REQUIRED" ? refusal(t, "VERDICT_NOTE_REQUIRED").text : null}
              heldBy={heldBy}
              fee={{ label: t("reg14.feeLabel"), value: proposal.feeMinor !== null ? money(proposal.feeMinor, proposal.currency, locale) : null, missing: feeFact.missing ?? "" }}
              locale={locale}
            />
          </form>
        ) : null}
        {proposal.status === "APPROVED" && verdict !== null ? (
          <StatusLine
            family="positive"
            text={t("reg14.approvedLine", { at: moment(verdict.at, locale) })}
            detail={
              detail.issued !== null
                ? t("reg14.approvedDecided", { r: detail.reference, o: detail.issued })
                : t("reg14.approvedRefused", { r: detail.reference })
            }
            cutout="surface"
            locale={locale}
          />
        ) : null}
        {proposal.status === "RETURNED" && verdict !== null ? (
          <StatusLine family="neutral" text={t("reg14.returnedLine", { at: moment(verdict.at, locale) })} detail={t("reg14.returnedDetail", { r: detail.reference })} cutout="surface" locale={locale} />
        ) : null}
        {proposal.status === "CLOSED_BY_WITHDRAWAL" ? (
          <StatusLine
            family="neutral"
            text={t("reg14.closedLine")}
            {...(detail.withdrawal !== null ? { detail: t("reg14.closedDetail", { r: detail.reference, i: detail.withdrawal.instruction }) } : {})}
            cutout="surface"
            locale={locale}
          />
        ) : null}
      </Panel>
    </Columns>
  );
}

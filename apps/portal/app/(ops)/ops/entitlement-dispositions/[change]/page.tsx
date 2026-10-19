import {
  ApprovalPair,
  Banner,
  Button,
  ButtonRow,
  ChoiceList,
  Columns,
  FactList,
  PageHeader,
  Panel,
  Skeleton,
  Table,
  TextField,
  Toast,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConfirmSubmit } from "@/features/parties/ConfirmSubmit";
import { decideAction, proposeAction } from "@/features/parties/premises-actions";
import { capital, day, dispositionStatus, entitlementInline, entitlementTitle, moment, money, premisesRefusal, premisesTranslator, stamp, writtenWords } from "@/features/parties/premises-copy";
import { SubmitButton } from "@/features/parties/SubmitButton";
import { readForPage } from "@/lib/api/flash";
import { loadChangeDispositions, type ChangeDispositions, type DispositionRow, type PremisesAttempt } from "@/lib/api/premises";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const DECIDE = "pty16-decide";

/**
 * SCR-PTY-16 Entitlement disposition: what one premises change left behind. Two readers. The business approver reads
 * each record issued before the change with the party it was issued to, its state and its proposal with the ground,
 * and decides one awaiting approval with Approve transfer or Leave in place and a ground, each asked first; leaving it
 * in place is an outcome with the approver's name, not the absence of a decision (FR-PTY-013). The operations officer
 * reads the same page on the operations console, told a business approver decides, with no decision control
 * (PERM-423); a record nothing was proposed for takes the officer's proposal here, which no board draws (finding F-6).
 */
export default async function ChangeDispositionsPage({ params, searchParams }: { params: Promise<{ change: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-BIZ-APR", "ACT-OPS", "ACT-AUD");
  const [{ change }, query] = await Promise.all([params, searchParams]);
  const id = decodeURIComponent(change);
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(query, PREMISES_VIEWS);
  const outcome = asked === "loading" ? null : await loadChangeDispositions(staff, id, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const approver = holds(staff, "ACT-BIZ-APR");
  const attempt = readForPage<PremisesAttempt>(query);
  const requested = typeof query.record === "string" ? query.record : null;
  const selected = data !== null ? (data.rows.find((row) => row.id === requested) ?? data.rows.find((row) => row.state === "AWAITING_APPROVAL") ?? data.rows[0] ?? null) : null;
  const kept = attempt !== null && selected !== null && attempt.subject === selected.id && (attempt.form === "decide" || attempt.form === "propose") ? attempt : null;

  return (
    <OpsFrame
      console={approver ? "approvals" : "operations"}
      current={approver ? "dispositions" : "parties"}
      staff={staff}
      searchLabel={approver ? t("prm.searchApprovals") : t("party.search")}
      keyMap={[{ keys: ["J", "K"], label: t("pty16.kMove") }, { keys: ["Enter"], label: t("pty16.kOpen") }, ...(approver ? [{ keys: ["Esc"], label: t("pty16.kEsc") }] : [])]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={
            approver
              ? [{ label: t("prm.crumbApprovals") }, { label: t("pty16.listTitlePage"), href: routes.opsEntitlementDispositions() }]
              : [
                  { label: t("party.crumb"), href: routes.opsParties() },
                  { label: t("pty16.listTitlePage"), href: routes.opsEntitlementDispositions() },
                ]
          }
          title={data !== null ? data.change.premises.name : t("pty16.listTitlePage")}
          {...(data !== null ? { meta: meta(data, t, locale) } : {})}
          locale={locale}
        >
          {/* PTY-07 admits operations, data and assurance; an approver alone would be sent back to /ops. */}
          {data !== null && holds(staff, "ACT-OPS", "ACT-DAT", "ACT-AUD") ? (
            <Button variant="secondary" size="sm" href={routes.opsPremises(data.change.premises.record)} locale={locale}>
              {t("pty16.openPremises")}
            </Button>
          ) : null}
        </PageHeader>
        {typeof kept?.done === "string" && selected !== null ? <Done row={selected} form={kept.form} t={t} locale={locale} /> : null}
        {asked === "loading" ? (
          <>
            <Panel title={t("pty16.listTitle")} compact locale={locale}>
              <Table columns={[{ key: "record", label: t("pty16.cRecord") }]} rows={[]} loading={3} density="console" caption={t("pty16.listTitle")} locale={locale} />
            </Panel>
            <Panel compact locale={locale}>
              <Skeleton variant="facts" rows={4} density="console" locale={locale} />
            </Panel>
          </>
        ) : failure?.code === "DISPOSITION_NOT_FOUND" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            <ViewState view="refused" refusal={{ ...premisesRefusal(t, failure.code), family: "attention" }} density="console" locale={locale} />
            <Button variant="secondary" size="sm" href={routes.opsEntitlementDispositions()} locale={locale}>
              {t("pty16.back")}
            </Button>
          </div>
        ) : failure !== null || data === null ? (
          <ViewState view="error" errorTitle={t("pty16.errTitle")} errorText={t("prm.errText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
        ) : (
          <>
            <Panel title={t("pty16.listTitle")} description={t("pty16.stays")} compact locale={locale}>
              <Table
                columns={[
                  { key: "record", label: t("pty16.cRecord"), kind: "stack", minWidth: "var(--space-56)" },
                  { key: "issued", label: t("pty16.cIssued"), minWidth: "var(--space-40)" },
                  { key: "st", label: t("pty16.cState"), kind: "status" },
                  { key: "decision", label: t("pty16.cDecision"), kind: "stack", detailSize: "sm" },
                ]}
                rows={data.rows.map((row) => recordRow(row, data, selected?.id === row.id, t, locale))}
                density="console"
                rowFocus
                caption={t("pty16.listTitle")}
                locale={locale}
              />
            </Panel>
            {selected !== null ? <Record row={selected} data={data} attempt={kept} approver={approver} t={t} locale={locale} /> : null}
          </>
        )}
      </div>
    </OpsFrame>
  );
}

function meta(data: ChangeDispositions, t: Translate, locale: Locale): string {
  const change = data.change;
  const values = { out: change.outgoing.legalName, eff: day(change.effectiveOn, locale), rec: day(change.recordedAt, locale), by: change.recordedBy };
  if (change.incoming !== null) return t("pty16.meta", { ...values, in: change.incoming.legalName });
  const cause = t(`prm.cause.${change.cause}`);
  return t("pty16.metaEnd", { ...values, cause, Cause: capital(cause) });
}

/** What a record is: its kind with its reference or period, or the fee with its amount. */
function recordStack(row: DispositionRow, t: Translate, locale: Locale): { text: string; detail?: string } {
  const entitlement = row.entitlement;
  if (entitlement.kind === "FEE") return { text: entitlementTitle(entitlement, t, locale), ...(entitlement.amountMinor !== null ? { detail: money(entitlement.amountMinor, locale) } : {}) };
  const period = entitlement.period !== null ? `${day(entitlement.period.from, locale)} – ${day(entitlement.period.to, locale)}` : null;
  return { text: entitlementTitle(entitlement, t, locale), detail: [entitlement.reference ?? "", period ?? ""].filter((part) => part !== "").join(", ") };
}

function recordRow(row: DispositionRow, data: ChangeDispositions, selected: boolean, t: Translate, locale: Locale): Record<string, unknown> {
  const issuedTo = row.issuedTo.legalName;
  const decision =
    row.decision !== null
      ? {
          text:
            row.decision.outcome === "TRANSFER"
              ? t("pty16.transferredBy", { p: row.heldBy?.legalName ?? "", who: row.decision.by })
              : row.decision.outcome === "CLOSE"
                ? t("pty16.closedBy", { who: row.decision.by })
                : t("pty16.leftBy", { who: row.decision.by }),
          detail: t("pty16.decisionDetail", { ts: stamp(row.decision.at, locale), ground: writtenWords(row.decision.ground, t, locale) }),
        }
      : row.proposal !== null
        ? {
            text: row.proposal.outcome === "TRANSFER" ? t("pty16.proposedTransfer", { p: row.proposal.receiving?.legalName ?? "" }) : t("pty16.proposedClose"),
            detail: t("pty16.proposalDetail", { who: row.proposal.by, ts: stamp(row.proposal.at, locale) }),
          }
        : { text: t("pty16.nothingProposed"), detail: t("pty16.nothingDetail", { p: issuedTo }) };
  return {
    _key: row.id,
    _href: routes.opsChangeDispositions(data.change.id, row.id),
    ...(selected ? { _selected: true } : {}),
    record: recordStack(row, t, locale),
    issued: issuedTo,
    st: dispositionStatus(row.state, t),
    decision,
  };
}

/** The record opened under the table: its facts and the proposer and approver as one pair, the decision at right. */
function Record({ row, data, attempt, approver, t, locale }: { row: DispositionRow; data: ChangeDispositions; attempt: PremisesAttempt | null; approver: boolean; t: Translate; locale: Locale }) {
  const failed = attempt?.refusal ?? null;
  const proposal = row.proposal;
  const decision = row.decision;
  const issuedTo = row.issuedTo.legalName;
  const inline = entitlementInline({ kind: row.entitlement.kind, reference: row.entitlement.reference ?? "", from: row.entitlement.period?.from ?? "" }, t, locale);
  const sameActor = approver && proposal !== null && proposal.by === data.me && row.state === "AWAITING_APPROVAL";
  const canDecide = approver && data.mayDecide && row.state === "AWAITING_APPROVAL" && !sameActor;
  const canPropose = !approver && data.mayPropose && row.state === "RAISED";
  const title = row.entitlement.reference !== null && row.entitlement.kind !== "FEE" ? `${entitlementTitle(row.entitlement, t, locale)} ${row.entitlement.reference}` : entitlementTitle(row.entitlement, t, locale);
  const receiving = proposal?.receiving?.legalName ?? data.change.incoming?.legalName ?? "";
  const facts =
    decision !== null
      ? [
          {
            label: t("pty16.fOutcome"),
            value: decision.outcome === "TRANSFER" ? t("pty16.transfer", { p: row.heldBy?.legalName ?? receiving }) : decision.outcome === "CLOSE" ? t("pty16.closedOutcome") : t("pty16.staysWith", { p: issuedTo }),
          },
          ...(proposal !== null
            ? [
                { label: t("pty16.fIssued"), value: issuedTo },
                ...(row.heldBy !== null ? [{ label: t("pty16.fHeld"), value: row.heldBy.legalName }] : []),
                { label: t("pty16.fPropGround"), value: writtenWords(proposal.ground, t, locale) },
              ]
            : [
                { label: t("pty16.fDecidedBy"), value: t("pty16.decidedWhen", { who: decision.by, ts: moment(decision.at, locale) }) },
                { label: t("pty16.fDecGround"), value: writtenWords(decision.ground, t, locale) },
                ...(row.entitlement.amountMinor !== null ? [{ label: t("pty16.fAmount"), value: { amountMinor: row.entitlement.amountMinor, currency: "VND" }, kind: "money" as const }] : []),
              ]),
        ]
      : proposal !== null
        ? [
            { label: t("pty16.fIssued"), value: issuedTo },
            { label: t("pty16.fProposal"), value: proposal.outcome === "TRANSFER" ? t("pty16.transfer", { p: receiving }) : t("pty16.close") },
            { label: t("pty16.fPropGround"), value: writtenWords(proposal.ground, t, locale) },
          ]
        : [
            { label: t("pty16.fIssued"), value: issuedTo },
            { label: t("pty16.fProposal"), value: t("pty16.nothingProposed"), note: t("pty16.nothingDetail", { p: issuedTo }) },
            ...(row.entitlement.amountMinor !== null ? [{ label: t("pty16.fAmount"), value: { amountMinor: row.entitlement.amountMinor, currency: "VND" }, kind: "money" as const }] : []),
          ];
  const notAwaiting = failed?.code === "DISPOSITION_NOT_AWAITING_APPROVAL";
  return (
    <Panel title={title} status={dispositionStatus(row.state, t)} compact locale={locale}>
      <Columns single={!(canDecide || canPropose)} gap={8}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
          {notAwaiting || (failed !== null && failed.code !== "GROUND_REQUIRED") ? (
            <Banner
              family="attention"
              title={notAwaiting ? (decision !== null ? t("pty16.naTitle", { t: `${stamp(decision.at, locale)}` }) : t("pty16.naTitlePlain")) : premisesRefusal(t, failed?.code ?? "", failed?.values ?? {}).title}
              code={failed?.code ?? ""}
              compact
              density="console"
              live
              locale={locale}
            >
              {premisesRefusal(t, failed?.code ?? "", failed?.values ?? {}).text}
            </Banner>
          ) : null}
          <FactList items={facts} density="console" locale={locale} />
          {proposal !== null ? (
            <ApprovalPair
              preparer={{ name: proposal.by, role: t(`prm.role.${proposal.role}`), at: proposal.at }}
              approver={decision !== null ? { name: decision.by, role: t(`prm.role.${decision.role}`), at: decision.at } : null}
              {...(decision !== null
                ? { decision: decision.outcome === "LEAVE_IN_PLACE" ? ("declined" as const) : ("approved" as const), comment: writtenWords(decision.ground, t, locale) }
                : { awaiting: approver ? (sameActor ? t("pty16.waitOther") : t("pty16.waitYou")) : t("pty16.waitApprover") })}
              {...(sameActor ? { sameActor: { code: "SAME_ACTOR_AS_PROPOSER", text: premisesRefusal(t, "SAME_ACTOR_AS_PROPOSER").text, family: "attention" as const } } : {})}
              preparerLabel={t("pty16.proposerLabel")}
              approverLabel={t("prm.role.BIZ_APR")}
              locale={locale}
            />
          ) : null}
          {!approver && row.state === "AWAITING_APPROVAL" && proposal !== null ? (
            <Text size="sm" tone="secondary">
              {t(proposal.outcome === "TRANSFER" ? "pty16.opsLine" : "pty16.opsLineClose", { p: issuedTo })}
            </Text>
          ) : null}
        </div>
        {canDecide && proposal !== null ? (
          <form id={DECIDE} action={decideAction.bind(null, data.change.id, row.id)} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
            <input type="hidden" name="intent" value="APPROVE" />
            <TextField
              label={t("pty16.ground")}
              helper={t("pty16.groundHelp")}
              name="ground"
              value={typeof attempt?.values.ground === "string" ? attempt.values.ground : ""}
              {...(failed?.code === "GROUND_REQUIRED" ? { error: premisesRefusal(t, "GROUND_REQUIRED").text } : {})}
              multiline
              rows={4}
              required
              width="100%"
              density="console"
              locale={locale}
            />
            <ButtonRow>
              <ConfirmSubmit
                formId={DECIDE}
                intent="APPROVE"
                label={proposal.outcome === "TRANSFER" ? t("pty16.approve") : t("pty16.approveClose")}
                dialog={
                  proposal.outcome === "TRANSFER"
                    ? { title: t("pty16.apTitle", { e: inline, p: receiving }), description: t("pty16.apText", { p: receiving, e: t(`prm.entitlementKind.${row.entitlement.kind}`) }), confirm: t("pty16.apYes", { p: receiving }), back: t("prm.back") }
                    : { title: t("pty16.acTitle", { e: inline }), description: t("pty16.acText"), confirm: t("pty16.acYes"), back: t("prm.back") }
                }
                typed={[{ name: "ground", label: t("pty16.fDecGround"), none: t("prm.none") }]}
                density="console"
                locale={locale}
              />
              <ConfirmSubmit
                formId={DECIDE}
                intent="LEAVE_IN_PLACE"
                variant="secondary"
                label={t("pty16.leave")}
                dialog={{ title: t("pty16.lvTitle", { e: inline, p: issuedTo }), description: t("pty16.lvText"), confirm: t("pty16.lvYes", { p: issuedTo }), back: t("prm.back") }}
                typed={[{ name: "ground", label: t("pty16.fDecGround"), none: t("prm.none") }]}
                density="console"
                locale={locale}
              />
            </ButtonRow>
          </form>
        ) : null}
        {canPropose ? <ProposalForm row={row} data={data} attempt={attempt} t={t} locale={locale} /> : null}
      </Columns>
    </Panel>
  );
}

/** The officer's proposal for a record nothing was proposed for: a transfer to the incoming party or a closure. */
function ProposalForm({ row, data, attempt, t, locale }: { row: DispositionRow; data: ChangeDispositions; attempt: PremisesAttempt | null; t: Translate; locale: Locale }) {
  const failed = attempt?.refusal ?? null;
  const incoming = data.change.incoming;
  const typed = (name: string) => (typeof attempt?.values[name] === "string" ? attempt.values[name] : "");
  return (
    <form action={proposeAction.bind(null, data.change.id, row.id)} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      <Text as="h3" size="base" weight="semibold">
        {t("pty16.proposeTitle")}
      </Text>
      <Text size="sm" tone="secondary">
        {t("pty16.proposeDesc")}
      </Text>
      {failed !== null && failed.field === null ? (
        <Banner family="attention" title={premisesRefusal(t, failed.code, failed.values).title} code={failed.code} compact density="console" live locale={locale}>
          {premisesRefusal(t, failed.code, failed.values).text}
        </Banner>
      ) : null}
      <ChoiceList
        legend={t("pty16.fOutcomeChoice")}
        name="proposed_outcome"
        options={[
          { value: "TRANSFER", label: incoming !== null ? t("pty16.oTransfer", { p: incoming.legalName }) : t("pty16.oTransferNone"), helper: t("pty16.oTransferHelp") },
          { value: "CLOSE", label: t("pty16.oClose"), helper: t("pty16.oCloseHelp") },
        ]}
        value={typed("proposed_outcome") || (incoming !== null ? "TRANSFER" : "CLOSE")}
        {...(failed?.field === "proposed_outcome" || failed?.field === "receiving_party_id" ? { error: premisesRefusal(t, failed.code).text } : {})}
        required
        density="console"
        locale={locale}
      />
      <TextField
        label={t("pty16.propGround")}
        helper={t("pty16.propGroundHelp")}
        name="ground"
        value={typed("ground")}
        {...(failed?.code === "GROUND_REQUIRED" ? { error: premisesRefusal(t, "GROUND_REQUIRED").text } : {})}
        multiline
        rows={4}
        required
        width="100%"
        density="console"
        locale={locale}
      />
      <div>
        <SubmitButton variant="primary" size="sm" locale={locale}>
          {t("pty16.propose")}
        </SubmitButton>
      </div>
    </form>
  );
}

/** What the act just recorded, above the records. */
function Done({ row, form, t, locale }: { row: DispositionRow; form: PremisesAttempt["form"]; t: Translate; locale: Locale }) {
  const e = capital(entitlementInline({ kind: row.entitlement.kind, reference: row.entitlement.reference ?? "", from: row.entitlement.period?.from ?? "" }, t, locale));
  const text =
    form === "propose"
      ? t("pty16.proposedToastText")
      : row.state === "TRANSFERRED"
        ? t("pty16.decidedTransfer", { e, p: row.heldBy?.legalName ?? "" })
        : row.state === "CLOSED"
          ? t("pty16.decidedClosed", { e })
          : t("pty16.decidedLeft", { e, p: row.issuedTo.legalName });
  return (
    <div style={{ maxWidth: "var(--container-lg)" }}>
      <Toast family="positive" title={t(form === "propose" ? "pty16.proposedToast" : "pty16.decidedToast")} locale={locale}>
        {text}
      </Toast>
    </div>
  );
}

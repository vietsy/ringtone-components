import { Banner, Button, ButtonRow, ChoiceList, EmptyState, FactList, PageHeader, Panel, Skeleton, Table, TextField, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { PublicShell } from "@/components/shells/PublicShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { answerRequest, supplyEvidence, withdrawCase } from "@/features/cases/actions";
import { casTranslator, caseStatus, day, nextStep, readerOf } from "@/features/cases/copy";
import { RequiredForm, RequiredSubmit } from "@/features/cases/RequiredForm";
import { WithdrawCase } from "@/features/cases/WithdrawCase";
import { ANSWER_OUTCOMES, DISCLOSURES, loadCase, type CaseAttempt, type CaseView, type EvidenceRequest } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { loadHelpRoutes } from "@/lib/api/public";
import { currentPrincipal, currentWorld } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAS02_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;
type Failure = { code: string; traceId: string | null; retryable: boolean };

/**
 * SCR-CAS-02 My case. The reference is the credential on this route: whoever holds it reads the case, and the
 * page shows the raiser's own case and nothing about any other party. A principal reads it inside their portal,
 * anyone else on the public surface; withdrawing is the raiser's alone, as the backend decides. What the case team
 * holds is listed with its content withheld where its disclosure status says so, and why (AC-FR-CAS-006-02); the
 * raiser may add an item of their own, choosing who may see it before it is supplied. A case closed without a
 * decision says why and until when it can be reopened, and a closed case offers the reopening on SCR-CAS-08.
 */
export default async function CasePage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }) {
  // No guard turns a reader away: the reference, not the session, opens the case.
  const principal = await currentPrincipal();
  const [{ reference: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = casTranslator(locale);
  const view = reviewView(query, CAS02_VIEWS);
  const attempt = view === null ? readForPage<CaseAttempt>(query) : null;
  const kept = attempt?.page === "case" && attempt.reference === reference ? attempt : null;
  // A refused answer is said beside its request, a refused item beside its form; every other refusal in the page header.
  const refusal = kept !== null && kept.request === undefined ? kept.refusal : null;
  const key = principal?.sessionId ?? (await currentWorld());
  const outcome = view === "loading" ? null : await loadCase(key, reference, readerOf(principal), view);
  const record = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";
  const supportLine = record?.supportLine ?? (await loadHelpRoutes()).data?.find((route) => route.kind === "support_line")?.value ?? "";

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0, maxWidth: phone ? "100%" : "var(--container-3xl)" }}>
      <PageHeader
        {...(principal !== null ? { crumbs: [{ label: t("casMine.crumb"), href: routes.myCases() }] } : { size: "public" as const })}
        title={t("cas02.title", { ref: reference })}
        locale={locale}
      />

      {refusal !== null ? (
        <Banner family="attention" title={t(`cas.refusal.${refusal}.title`)} code={refusal} live density="portal" locale={locale}>
          {t(`cas.refusal.${refusal}.text`, { state: record !== null ? t(`cas.state.${record.state}`) : "", permitted: t("cas02.permitted") })}
        </Banner>
      ) : null}

      {view === "loading" ? <Loading phone={phone} locale={locale} /> : null}
      {failure !== null ? <Failed failure={failure} supportLine={supportLine} phone={phone} t={t} locale={locale} /> : null}
      {record !== null ? <Case record={record} kept={kept} phone={phone} t={t} locale={locale} /> : null}
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

function Loading({ phone, locale }: { phone: boolean; locale: Locale }) {
  const inset = phone ? "sm" : "md";
  return (
    <>
      {(["facts", "text", "table", "text"] as const).map((variant, index) => (
        <Panel key={`${variant}-${String(index)}`} inset={inset} density="portal" locale={locale}>
          <Skeleton variant={variant} rows={2} density="portal" locale={locale} />
        </Panel>
      ))}
    </>
  );
}

/**
 * Three failures, three sentences (the specification's note on SCR-CAS-02): a reference that names nothing, a
 * case now under restricted access, and our outage. Each but the first carries a reference to quote to support. A
 * case of the party the person's authority does not reach - a delegate's of another premises (PTY, DR-201) - is
 * ROLE_OUT_OF_SCOPE, said in the family's own words.
 */
function Failed({ failure, supportLine, phone, t, locale }: { failure: Failure; supportLine: string; phone: boolean; t: Translate; locale: Locale }) {
  const trace = failure.traceId ?? "";
  if (failure.code === "ROLE_OUT_OF_SCOPE") {
    return (
      <ViewState
        level={2}
        view="refused"
        refusal={{ code: failure.code, title: t("cas.refusal.ROLE_OUT_OF_SCOPE.title"), text: t("cas.refusal.ROLE_OUT_OF_SCOPE.text"), family: "attention" }}
        density="portal"
        locale={locale}
      />
    );
  }
  if (failure.code === "CASE_NOT_FOUND" || failure.code === "PROTECTED_MATTER_NO_ACCESS") {
    const notFound = failure.code === "CASE_NOT_FOUND";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)" }}>
        <ViewState
          level={2}
          view="refused"
          refusal={{
            code: failure.code,
            title: t(notFound ? "cas02.nfTitle" : "cas02.protTitle"),
            text: notFound ? t("cas02.nfText", { number: supportLine }) : t("cas02.protText", { trace }),
            family: "attention",
          }}
          density="portal"
          locale={locale}
        />
        <div>
          <Button variant="secondary" size="md" href={routes.raiseCase()} fullWidth={phone} locale={locale}>
            {t("cas02.raiseNew")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ViewState
      level={2}
      view="error"
      errorTitle={t("cas02.errTitle")}
      errorText={t("cas02.errText", { trace })}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      density="portal"
      locale={locale}
    />
  );
}

function Case({ record, kept, phone, t, locale }: { record: CaseView; kept: CaseAttempt | null; phone: boolean; t: Translate; locale: Locale }) {
  const inset = phone ? "sm" : "md";
  const ended = record.state === "WITHDRAWN";
  const decided = record.decision !== null;
  const withdrawReason = record.canWithdraw ? null : t(decided ? "cas.refusal.CASE_ALREADY_DECIDED.text" : "cas02.cannotWithdraw");
  return (
    <>
      <Panel inset={inset} gap="md" density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("cas02.reference"), value: record.reference, kind: "id" },
            { label: t("cas02.raisedAt"), value: record.submittedAt, kind: "datetime" },
            { label: t("cas02.status"), value: caseStatus(record.state, t), kind: "status" },
            ...(record.subject !== null ? [{ label: t("cas02.subject"), value: record.subject, kind: "mono" as const }] : []),
          ]}
          columns={phone ? 1 : 2}
          density="portal"
          locale={locale}
        />
        <Text size="sm" tone="secondary">
          {t("cas02.stable")}
        </Text>
      </Panel>

      <Panel title={t("cas02.next")} level={2} inset={inset} gap="md" density="portal" locale={locale}>
        <Text size="base" measure="2xl">
          {nextStep(record, t, locale)}
        </Text>
        {record.referral !== null ? (
          <Text size="base" measure="2xl">
            {t("cas02.referred", { d: day(record.referral.at, locale), process: record.referral.process })}
          </Text>
        ) : null}
        {record.closure !== null ? (
          <>
            <Text size="base" measure="2xl">
              {record.closure.disposition === "inadmissible"
                ? t("cas02.closedInadmissible", { reason: record.closure.reason, route: record.closure.route ?? "" })
                : t("cas02.closedIncomplete", { reason: record.closure.reason })}
            </Text>
            {record.closure.windowEnds !== null ? (
              <Text size="base" measure="2xl">
                {t("cas02.reopenUntil", { d: day(record.closure.windowEnds, locale) })}
              </Text>
            ) : null}
          </>
        ) : null}
        {record.reopening !== null && record.reopening.state !== "REOPENED" ? (
          <Text size="base" measure="2xl">
            {record.reopening.state === "REOPEN_PROPOSED"
              ? t("cas02.reopenProposed", { d: day(record.reopening.proposedAt, locale) })
              : t("cas02.reopenRefused", { d: day(record.reopening.decidedAt ?? record.reopening.proposedAt, locale), reason: record.reopening.refusedReason ?? "" })}
          </Text>
        ) : null}
        {!ended && record.referral === null ? (
          <FactList items={[{ label: t("cas02.owner"), value: record.owner ?? t("cas02.caseTeam") }]} density="portal" locale={locale} />
        ) : null}
      </Panel>

      <Panel title={t("cas02.asked")} level={2} inset={inset} density="portal" locale={locale}>
        {record.evidenceRequests.length === 0 ? (
          <EmptyState variant="governed" title={t("cas02.askedNone")} level={3} density="portal" locale={locale}>
            {t("cas02.askedNoneText")}
          </EmptyState>
        ) : (
          <Table
            columns={[
              { key: "item", label: t("cas02.cItem"), kind: "text" },
              { key: "due", label: t("cas02.cDue"), kind: "date" },
              { key: "outcome", label: t("cas02.cOutcome"), kind: "status" },
            ]}
            rows={record.evidenceRequests.map((request) => ({
              _key: request.id,
              item: request.item,
              due: request.deadline,
              outcome: {
                family: request.state === "OVERDUE" ? "attention" : "neutral",
                label: t(request.receiptOutcome !== null ? `cas.receipt.${request.receiptOutcome}` : `cas.request.${request.state}`),
                plain: true,
              },
            }))}
            density="portal"
            layout={phone ? "cards" : "table"}
            caption={t("cas02.asked")}
            locale={locale}
          />
        )}
        {record.evidenceRequests
          .filter((request) => request.answerable || kept?.request === request.id)
          .map((request) => (
            <AnswerRequest key={request.id} reference={record.reference} request={request} kept={kept?.request === request.id ? kept : null} phone={phone} t={t} locale={locale} />
          ))}
      </Panel>

      <Held record={record} kept={kept?.request === "evidence" ? kept : null} phone={phone} t={t} locale={locale} />

      <Panel title={t("cas02.decision")} level={2} inset={inset} gap="md" density="portal" locale={locale}>
        {record.decision !== null ? (
          <FactList
            items={[
              { label: t("cas02.dFacts"), value: record.decision.facts },
              { label: t("cas02.dAuthority"), value: record.decision.authority },
              { label: t("cas02.dReasoning"), value: record.decision.reasoning },
              { label: t("cas02.dRemedy"), value: t(`cas.remedy.${record.decision.remedy}`) },
              { label: t("cas02.dEffective"), value: record.decision.effectiveDate, kind: "date" },
              { label: t("cas02.dMaker"), value: record.decision.decisionMaker },
              { label: t("cas02.dRoute"), value: record.decision.appealRoute },
              ...(record.decision.appealDeadline !== null
                ? [{ label: t("cas02.dDeadline"), value: record.decision.appealDeadline, kind: "date" as const }]
                : []),
            ]}
            density="portal"
            locale={locale}
          />
        ) : (
          <Text size="base" measure="2xl">
            {t(ended ? "cas02.noDecisionEnded" : "cas02.noDecision")}
          </Text>
        )}
        {record.reopenedOn !== null ? (
          <Text size="base" measure="2xl">
            {t("cas02.reopened", { d: day(record.reopenedOn, locale) })}
          </Text>
        ) : null}
      </Panel>

      {record.appeal !== null ? (
        <Panel title={t("cas02.appeal")} level={2} inset={inset} gap="md" density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("cas02.aReceived"), value: record.appeal.receivedAt, kind: "datetime" },
              ...(record.appeal.outcome === null
                ? [
                    {
                      label: t("cas02.aDue"),
                      value: record.appeal.dueAt,
                      kind: "date" as const,
                      missing: t("cas02.aNoDue"),
                      ...(record.appeal.late ? { note: t("cas02.aLate") } : {}),
                    },
                  ]
                : [
                    { label: t("cas02.aOutcome"), value: t(`cas.outcome.${record.appeal.outcome.outcome}`) },
                    { label: t("cas02.dFacts"), value: record.appeal.outcome.facts },
                    { label: t("cas02.dAuthority"), value: record.appeal.outcome.authority },
                    { label: t("cas02.dReasoning"), value: record.appeal.outcome.reasoning },
                    { label: t("cas02.dRemedy"), value: record.appeal.outcome.remedy !== null ? t(`cas.remedy.${record.appeal.outcome.remedy}`) : t("cas02.aUnchanged") },
                    ...(record.appeal.outcome.effectiveDate !== null ? [{ label: t("cas02.dEffective"), value: record.appeal.outcome.effectiveDate, kind: "date" as const }] : []),
                    { label: t("cas02.aFurther"), value: record.appeal.outcome.furtherRoute },
                    { label: t("cas02.aDecidedAt"), value: record.appeal.outcome.decidedAt, kind: "datetime" as const },
                  ]),
            ]}
            density="portal"
            locale={locale}
          />
          {record.appeal.outcome === null ? (
            <Text size="base" measure="2xl">
              {record.appeal.dueAt === null
                ? t("cas02.aWaitingUnmeasured")
                : t(record.appeal.state === "APPEAL_LAPSED" ? "cas.refusal.APPEAL_LAPSED.text" : "cas02.aWaiting", { d: day(record.appeal.dueAt, locale) })}
            </Text>
          ) : null}
        </Panel>
      ) : null}

      {!ended ? (
        <ButtonRow align="between">
          <WithdrawCase
            copy={{
              withdraw: t("cas02.withdraw"),
              title: t("cas02.wTitle", { ref: record.reference }),
              text: t("cas02.wText"),
              confirm: t("cas02.wConfirm"),
              keep: t("cas02.wKeep"),
            }}
            action={withdrawCase.bind(null, record.reference)}
            disabledReason={withdrawReason}
            phone={phone}
            locale={locale}
          />
          {/* Lodging an appeal (SCR-CAS-08) needs an issued decision; until then the button says why it waits. Where the
              appeal is no longer the route and the case is closed, SCR-CAS-08 offers the reopening instead. */}
          {record.canReopen ? (
            <Button variant="primary" size="md" href={routes.lodgeAppeal(record.reference)} fullWidth={phone} locale={locale}>
              {t("cas02.askReopen")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              {...(record.canAppeal
                ? { href: routes.lodgeAppeal(record.reference) }
                : { disabled: true, disabledReason: t(!decided ? "cas.refusal.NO_DECISION_TO_APPEAL.text" : record.appeal?.state === "UNDER_APPEAL" ? "cas02.appealOpen" : "cas02.appealDecided") })}
              fullWidth={phone}
              locale={locale}
            >
              {t("cas02.challenge")}
            </Button>
          )}
        </ButtonRow>
      ) : null}
    </>
  );
}

/**
 * Answer this request, for the party it addresses: what arrived, chosen with no default, and what is supplied
 * with it; the status it will carry is shown before it is supplied. A refused answer is said here, beside it.
 */
function AnswerRequest({
  reference,
  request,
  kept,
  phone,
  t,
  locale,
}: {
  reference: string;
  request: EvidenceRequest;
  kept: CaseAttempt | null;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const typed = (name: string) => kept?.values?.[name] ?? "";
  const outcomeError = kept?.refusal === "RECEIPT_OUTCOME_REQUIRED" ? { error: t("cas.refusal.RECEIPT_OUTCOME_REQUIRED.text") } : {};
  const suppliedError = kept?.refusal === "FIELD_MISSING" ? { error: t("cas.refusal.FIELD_MISSING.text", { field: t("cas02.suppliedField") }) } : {};
  return (
    <Panel title={t("cas02.answerTitle", { item: request.item })} level={3} variant="sunken" inset={phone ? "sm" : "md"} gap="md" density="portal" locale={locale}>
      {kept?.refusal === "REQUEST_CANCELLED" || kept?.refusal === "ROLE_OUT_OF_SCOPE" ? (
        <Banner family="attention" title={t(`cas.refusal.${kept.refusal}.title`)} code={kept.refusal} live density="portal" locale={locale}>
          {t(`cas.refusal.${kept.refusal}.text`)}
        </Banner>
      ) : null}
      {request.answerable ? (
        <RequiredForm action={answerRequest.bind(null, reference, request.id)} required={["receipt_outcome"]} initiallyMissing={typed("outcome") === "" ? ["receipt_outcome"] : []}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Text size="sm" tone="secondary">
              {t("cas02.answerDue", { d: day(request.deadline, locale), disclosure: t(`cas.disclosure.${request.disclosure}`) })}
            </Text>
            <ChoiceList
              legend={t("cas02.answerOutcome")}
              name="receipt_outcome"
              options={ANSWER_OUTCOMES.map((outcome) => ({ value: outcome, label: t(`cas.answer.${outcome}`) }))}
              {...(typed("outcome") !== "" ? { value: typed("outcome") } : {})}
              required
              {...outcomeError}
              density="portal"
              locale={locale}
            />
            <TextField
              label={t("cas02.supplied")}
              name="supplied"
              value={typed("supplied")}
              multiline
              rows={3}
              maxLength={500}
              helper={t("cas02.suppliedHelp")}
              {...suppliedError}
              density="portal"
              locale={locale}
            />
            <div>
              <RequiredSubmit variant="primary" size="md" fullWidth={phone} reasons={[{ field: "receipt_outcome", text: t("cas02.needOutcome") }]} locale={locale}>
                {t("cas02.answer")}
              </RequiredSubmit>
            </div>
          </div>
        </RequiredForm>
      ) : null}
    </Panel>
  );
}

/**
 * What the case team holds against the case, as this reader may see it (AC-FR-CAS-006-02): every item is listed, its
 * content shown where it is open or the reader's own, and otherwise withheld with the reason. Below it, the raiser
 * adds an item of their own, choosing who may see it before it is supplied (POST /cases/{id}/evidence).
 */
function Held({ record, kept, phone, t, locale }: { record: CaseView; kept: CaseAttempt | null; phone: boolean; t: Translate; locale: Locale }) {
  const inset = phone ? "sm" : "md";
  const typed = (name: string) => kept?.values?.[name] ?? "";
  const itemError =
    kept?.refusal === "FIELD_MISSING" ? { error: t("cas.refusal.FIELD_MISSING.text", { field: t("cas02.addItemField") }) } : {};
  const disclosureError = kept?.refusal === "DISCLOSURE_STATUS_REQUIRED" ? { error: t("cas.refusal.DISCLOSURE_STATUS_REQUIRED.text") } : {};
  return (
    <Panel title={t("cas02.held")} level={2} inset={inset} gap="md" density="portal" locale={locale}>
      {record.evidence.length === 0 ? (
        <EmptyState variant="governed" title={t("cas02.heldNone")} level={3} density="portal" locale={locale}>
          {t("cas02.heldNoneText")}
        </EmptyState>
      ) : (
        <Table
          columns={[
            { key: "item", label: t("cas02.cHeld"), kind: "stack" },
            { key: "who", label: t("cas02.cHeldWho") },
            { key: "at", label: t("cas02.cHeldAt"), kind: "date" },
          ]}
          rows={record.evidence.map((entry, index) => ({
            _key: `${entry.receivedAt}-${String(index)}`,
            item: entry.item !== null ? { text: entry.item, detail: t(`cas.disclosure.${entry.disclosure}`) } : { text: t(`cas02.withheld.${entry.disclosure}`), muted: true },
            who: t(entry.own ? "cas02.heldYou" : "cas02.heldOther"),
            at: entry.receivedAt,
          }))}
          density="portal"
          layout={phone ? "cards" : "table"}
          caption={t("cas02.held")}
          locale={locale}
        />
      )}
      {kept?.refusal === "TRANSITION_NOT_PERMITTED" || kept?.refusal === "ROLE_OUT_OF_SCOPE" ? (
        <Banner family="attention" title={t(`cas.refusal.${kept.refusal}.title`)} code={kept.refusal} live density="portal" locale={locale}>
          {t(`cas.refusal.${kept.refusal}.text`, { state: t(`cas.state.${record.state}`), permitted: t("cas02.permitted") })}
        </Banner>
      ) : null}
      {record.canAddEvidence ? (
        <Panel title={t("cas02.addTitle")} level={3} variant="sunken" inset={inset} gap="md" density="portal" locale={locale}>
          <RequiredForm
            action={supplyEvidence.bind(null, record.reference)}
            required={["item_ref", "disclosure_status"]}
            initiallyMissing={["item_ref", "disclosure_status"].filter((name) => typed(name) === "")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <TextField
                label={t("cas02.addItem")}
                name="item_ref"
                value={typed("item_ref")}
                multiline
                rows={3}
                maxLength={500}
                helper={t("cas02.addItemHelp")}
                required
                {...itemError}
                density="portal"
                locale={locale}
              />
              <ChoiceList
                legend={t("cas02.addDisclosure")}
                helper={t("cas02.addDisclosureHelp")}
                name="disclosure_status"
                options={DISCLOSURES.map((status) => ({ value: status, label: t(`cas.disclosure.${status}`) }))}
                {...(typed("disclosure_status") !== "" ? { value: typed("disclosure_status") } : {})}
                required
                {...disclosureError}
                density="portal"
                locale={locale}
              />
              <div>
                <RequiredSubmit
                  variant="secondary"
                  size="md"
                  fullWidth={phone}
                  reasons={[
                    { field: "item_ref", text: t("cas02.needItem") },
                    { field: "disclosure_status", text: t("cas02.needDisclosure") },
                  ]}
                  locale={locale}
                >
                  {t("cas02.add")}
                </RequiredSubmit>
              </div>
            </div>
          </RequiredForm>
        </Panel>
      ) : null}
    </Panel>
  );
}

import { Banner, Button, ButtonRow, ChoiceList, DateField, Disclosure, PageHeader, Panel, Select, Table, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { addEvidenceItem, cancelRequest, recordResponse, requestEvidence } from "@/features/cases/console-actions";
import { ConfirmSubmit } from "@/features/cases/ConfirmSubmit";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, fieldRefusal, opsStatus, refusalWords } from "@/features/cases/copy";
import { RequiredForm, RequiredSubmit } from "@/features/cases/RequiredForm";
import { isoDate } from "@/features/cases/dates";
import { ANSWER_OUTCOMES, DISCLOSURES, loadEvidencePage, type ConsoleAttempt, type EvidencePage, type EvidenceRow } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const REQUIRED = ["requested_item", "responsible_party", "deadline", "disclosure_status"] as const;
const ITEM_REQUIRED = ["item_ref", "disclosure_status", "supplied_by"] as const;

/** The states a request may be sent in: from TRIAGED the case is assigned to its owner first (SM-05 transitions 2 and 6). */
const REQUESTABLE = ["TRIAGED", "ASSIGNED", "INVESTIGATING", "AWAITING_EVIDENCE"];

/** A request in its state: overdue is attention, never danger; one that was answered or ended is neutral. */
const REQUEST_FAMILY = { ISSUED: "info", OVERDUE: "attention", RESPONDED: "neutral", NOT_SUPPLIED: "neutral", CANCELLED: "neutral" } as const;

/**
 * SCR-CAS-06 Evidence requests, for the case officer: the requests on the case with their deadlines, disclosure
 * statuses and outcomes, a new one composed below them, and an open one cancelled with its reason. The answering
 * block is the addressed party's alone and is on their case (SCR-CAS-02); staff are not parties here, but an answer
 * that arrived another way - by post, at the counter, by telephone - is recorded here by the officer. Every item held
 * against the case is listed, whatever brought it, and an item may be added on its own (POST /cases/{id}/evidence).
 */
export default async function EvidenceRequestsPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-CAS");
  const [{ reference: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const attempt = readForPage<ConsoleAttempt>(query);
  const kept = attempt !== null && attempt.subject === reference ? attempt : null;
  const outcome = view === "loading" ? null : await loadEvidencePage(staff, reference, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const cancelRefusal = kept !== null && (kept.form.startsWith("cancel:") || kept.form.startsWith("respond:")) ? kept.refusal : null;

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cas03.title"), href: routes.opsCases() }, { label: reference, href: routes.opsCase(reference) }]}
          title={t("cas06.title", { ref: reference })}
          {...(data !== null ? { status: opsStatus(data.state) } : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" icon="arrow-left" href={routes.opsCase(reference)} locale={locale}>
            {t("cas06.back")}
          </Button>
        </PageHeader>
        {cancelRefusal !== null && Object.keys(cancelRefusal.fields).length === 0 ? (
          <Banner family="danger" title={refusalWords(t, cancelRefusal, locale).title} code={cancelRefusal.code} live density="console" locale={locale}>
            {refusalWords(t, cancelRefusal, locale).text}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ConsoleFailure failure={failure} errorTitle={t("cas06.errTitle")} errorText={t("casops.errText")} action={{ label: t("cas04.back"), href: routes.opsCases() }} t={t} locale={locale} />
        ) : (
          <>
            <Panel title={t("cas06.requests")} level={2} density="console" locale={locale}>
              <Table
                columns={[
                  { key: "item", label: t("cas06.cItem"), kind: "stack" },
                  { key: "party", label: t("cas06.cParty") },
                  { key: "due", label: t("cas06.cDue"), kind: "date" },
                  { key: "disclosure", label: t("cas06.cDisclosure") },
                  { key: "state", label: t("cas06.cOutcome"), kind: "status" },
                ]}
                rows={(data?.rows ?? []).map((row) => requestRow(row, kept, t, locale))}
                loading={data === null ? 3 : false}
                empty={{ variant: "governed", title: t("cas06.emptyTitle"), text: t("cas06.emptyText"), action: false }}
                density="console"
                caption={t("cas06.requests")}
                locale={locale}
              />
              {(data?.rows ?? []).map((row) => (
                <CancelForm key={row.id} row={row} reference={reference} t={t} locale={locale} />
              ))}
              {(data?.rows ?? []).map((row) => (
                <RecordResponse key={`respond-${row.id}`} row={row} reference={reference} kept={kept?.form === `respond:${row.id}` ? kept : null} t={t} locale={locale} />
              ))}
            </Panel>
            {data !== null ? <Compose data={data} kept={kept?.form === "request" ? kept : null} t={t} locale={locale} /> : null}
            {data !== null ? <Held data={data} kept={kept?.form === "item" ? kept : null} t={t} locale={locale} /> : null}
          </>
        )}
      </div>
    </OpsFrame>
  );
}

/** One request: what was asked, of whom, by when, under which disclosure, and what came of it. */
function requestRow(row: EvidenceRow, kept: ConsoleAttempt | null, t: Translate, locale: Locale): Record<string, unknown> {
  const outcome = row.receiptOutcome !== null ? t(`cas.receipt.${row.receiptOutcome}`) : row.state;
  const refusal = kept?.form === `cancel:${row.id}` ? kept.refusal : null;
  return {
    _key: row.id,
    ...(row.state === "OVERDUE" ? { _tone: "attention" } : {}),
    ...(refusal !== null ? { _message: { severity: "error", text: refusalWords(t, refusal, locale).text, code: refusal.code } } : {}),
    item: {
      text: row.item,
      detail:
        row.supplied !== null
          ? [
              t("cas06.supplied", { what: row.supplied, t: day(row.respondedAt ?? row.issuedAt, locale) }),
              ...(row.late ? [t("cas06.late")] : []),
              ...(row.recordedBy !== null ? [t("cas06.recordedBy", { by: row.recordedBy })] : []),
            ].join(" ")
          : row.cancelled !== null
            ? t("cas06.cancelledOn", { d: day(row.cancelled.on, locale), reason: row.cancelled.reason })
            : t("cas06.issued", { d: day(row.issuedAt, locale), by: row.issuedBy }),
    },
    party: row.party,
    due: row.deadline,
    disclosure: t(`casops.disclosure.${row.disclosure}`),
    state: { family: REQUEST_FAMILY[row.state], label: outcome },
  };
}

/**
 * Cancel this request: a form per open request carrying its reason, which the dialog asks for and which names the
 * party who will be told. A request something was supplied against offers no cancel (RECEIPT_ALREADY_RECORDED); one
 * past its deadline draws it disabled with why, since SM-40 cancels an ISSUED request only (TRANSITION_NOT_PERMITTED).
 */
function CancelForm({ row, reference, t, locale }: { row: EvidenceRow; reference: string; t: Translate; locale: Locale }) {
  if (row.state !== "ISSUED" && row.state !== "OVERDUE") return null;
  // POST /evidence-requests/{id}/cancel: the officer who issued it, or the case owner; anyone else is told who may.
  const why = row.state === "OVERDUE" ? t("cas06.whyOverdue") : row.mayCancel ? null : t("cas06.whyCancel");
  const formId = `cancel-${row.id}`;
  return (
    <form id={formId} action={cancelRequest.bind(null, reference, row.id)} style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
      <input type="hidden" name="reason" value="" />
      <Text size="sm" tone="secondary">
        {t("cas06.cancelLine", { item: row.item })}
      </Text>
      <ConfirmSubmit
        formId={formId}
        label={t("cas06.cancel")}
        variant="quiet"
        disabledReason={why}
        field={{ name: "reason", label: t("cas06.reason"), helper: t("cas06.reasonHelp"), missing: t("cas06.reasonMissing") }}
        dialog={{
          title: t("cas06.cancelTitle", { item: row.item }),
          description: t("cas06.cancelText", { party: row.party }),
          confirm: t("cas06.cancelConfirm"),
          confirmVariant: "danger",
          back: t("cas06.cancelKeep"),
        }}
        locale={locale}
      />
    </form>
  );
}

/** Request another item: item, addressee, deadline inside the approved period, and the disclosure chosen before it is sent. */
function Compose({ data, kept, t, locale }: { data: EvidencePage; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const values = kept?.values ?? {};
  const value = (name: string) => {
    const typed = values[name];
    return typeof typed === "string" ? typed : "";
  };
  const refusal = kept?.refusal ?? null;
  const open = REQUESTABLE.includes(data.state);
  const field = (name: string, label: string) => fieldRefusal(t, refusal, name, label, locale);
  const initiallyMissing = REQUIRED.filter((name) => value(name) === "");
  return (
    <Panel title={t("cas06.compose")} level={2} density="console" gap="md" locale={locale}>
      {!open ? (
        <Text size="sm" tone="secondary">
          {t("cas06.closedState", { state: data.state })}
        </Text>
      ) : null}
      <RequiredForm action={requestEvidence.bind(null, data.reference)} required={REQUIRED} initiallyMissing={initiallyMissing}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-sm), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <TextField label={t("cas06.item")} name="requested_item" value={value("requested_item")} helper={t("cas06.itemHelp")} maxLength={500} required {...field("item", t("cas06.item"))} density="console" locale={locale} />
            <Select
              label={t("cas06.party")}
              name="responsible_party"
              options={data.addressees.map((entry) => ({ value: entry.value, label: entry.label }))}
              value={value("responsible_party")}
              placeholder={t("casops.choose")}
              required
              {...field("addressee", t("cas06.party"))}
              density="console"
              locale={locale}
            />
            <DateField
              label={t("cas06.due")}
              name="deadline"
              value={isoDate(value("deadline"))}
              min={data.today}
              {...(data.policy !== null ? { max: data.policy.latest } : {})}
              today={data.today}
              helper={data.policy !== null ? t("cas06.dueHelp", { n: data.policy.workingDays, d: day(data.policy.latest, locale) }) : t("cas06.noPolicy")}
              required
              {...field("deadline", t("cas06.due"))}
              density="console"
              locale={locale}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <ChoiceList
              legend={t("cas06.disclosure")}
              name="disclosure_status"
              options={DISCLOSURES.map((status) => ({ value: status, label: t(`casops.disclosure.${status}`), helper: t(`casops.disclosureHelp.${status}`) }))}
              {...(value("disclosure_status") !== "" ? { value: value("disclosure_status") } : {})}
              required
              {...field("disclosure", t("cas06.disclosure"))}
              density="console"
              locale={locale}
            />
            <Text size="sm" tone="secondary">
              {t("cas06.disclosureWhen")}
            </Text>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "var(--space-4)" }}>
          <RequiredSubmit
            variant="primary"
            size="sm"
            blocked={open ? null : t("cas06.closedState", { state: data.state })}
            reasons={[
              { field: "requested_item", text: t("cas06.needItem") },
              { field: "responsible_party", text: t("cas06.needParty") },
              { field: "deadline", text: t("cas06.needDue") },
              { field: "disclosure_status", text: t("cas06.needDisclosure") },
            ]}
            locale={locale}
          >
            {t("cas06.send")}
          </RequiredSubmit>
        </div>
      </RequiredForm>
    </Panel>
  );
}

/**
 * Record a response that arrived another way, for one open request: what arrived, chosen with no default and saying
 * so where nothing did (RECEIPT_OUTCOME_REQUIRED), and what was supplied with it. A refused attempt is said beside it.
 */
function RecordResponse({ row, reference, kept, t, locale }: { row: EvidenceRow; reference: string; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  if (row.state !== "ISSUED" && row.state !== "OVERDUE") return null;
  const typed = (name: string) => {
    const value = kept?.values[name];
    return typeof value === "string" ? value : "";
  };
  const refusal = kept?.refusal ?? null;
  return (
    <Disclosure title={t("cas06.recordTitle", { item: row.item })} level={3} density="console" {...(kept !== null ? { open: true } : {})} locale={locale}>
      <RequiredForm action={recordResponse.bind(null, reference, row.id)} required={["receipt_outcome"]} initiallyMissing={typed("receipt_outcome") === "" ? ["receipt_outcome"] : []}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Text size="sm" tone="secondary">
            {t("cas06.recordAbout", { disclosure: t(`casops.disclosure.${row.disclosure}`) })}
          </Text>
          <ChoiceList
            legend={t("cas06.recordOutcome")}
            name="receipt_outcome"
            options={ANSWER_OUTCOMES.map((outcome) => ({ value: outcome, label: t(`cas.answer.${outcome}`) }))}
            {...(typed("receipt_outcome") !== "" ? { value: typed("receipt_outcome") } : {})}
            layout="inline"
            required
            {...(refusal?.fields.outcome !== undefined ? { error: refusalWords(t, { ...refusal, code: refusal.fields.outcome }, locale).text } : {})}
            density="console"
            locale={locale}
          />
          <TextField
            label={t("cas06.recordSupplied")}
            name="supplied"
            value={typed("supplied")}
            multiline
            rows={2}
            maxLength={500}
            helper={t("cas06.recordSuppliedHelp")}
            {...fieldRefusal(t, refusal, "supplied", t("cas06.recordSupplied"), locale)}
            density="console"
            locale={locale}
          />
          <ButtonRow align="end">
            <RequiredSubmit variant="secondary" size="sm" reasons={[{ field: "receipt_outcome", text: t("cas06.needOutcome") }]} locale={locale}>
              {t("cas06.record")}
            </RequiredSubmit>
          </ButtonRow>
        </div>
      </RequiredForm>
    </Disclosure>
  );
}

/** Every item held against the case, whatever brought it, and Add an item: what it is, its status, who supplied it. */
function Held({ data, kept, t, locale }: { data: EvidencePage; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const typed = (name: string) => {
    const value = kept?.values[name];
    return typeof value === "string" ? value : "";
  };
  const refusal = kept?.refusal ?? null;
  const field = (name: string, label: string) => fieldRefusal(t, refusal, name, label, locale);
  const supplierLabel = (entry: { value: string; label: string }) => (entry.value === "team" ? t("cas06.team", { name: entry.label }) : entry.label);
  return (
    <Panel title={t("cas06.held")} level={2} density="console" gap="md" locale={locale}>
      <Table
        columns={[
          { key: "item", label: t("cas06.cHeldItem") },
          { key: "by", label: t("cas06.cSuppliedBy") },
          { key: "via", label: t("cas06.cVia") },
          { key: "disclosure", label: t("cas06.cDisclosure") },
          { key: "received", label: t("cas06.cReceived"), kind: "datetime" },
        ]}
        rows={data.held.map((entry, index) => ({
          _key: `${entry.receivedAt}-${String(index)}`,
          item: entry.item,
          by: entry.suppliedBy,
          via: t(`cas06.via.${entry.via}`),
          disclosure: t(`casops.disclosure.${entry.disclosure}`),
          received: entry.receivedAt,
        }))}
        empty={{ variant: "governed", title: t("cas06.heldEmptyTitle"), text: t("cas06.heldEmptyText"), action: false }}
        density="console"
        caption={t("cas06.held")}
        locale={locale}
      />
      <Disclosure title={t("cas06.addTitle")} level={3} density="console" {...(kept !== null ? { open: true } : {})} locale={locale}>
        <RequiredForm action={addEvidenceItem.bind(null, data.reference)} required={ITEM_REQUIRED} initiallyMissing={ITEM_REQUIRED.filter((name) => typed(name) === "")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-sm), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <TextField label={t("cas06.addItem")} name="item_ref" value={typed("item_ref")} helper={t("cas06.addItemHelp")} maxLength={500} required {...field("itemRef", t("cas06.addItem"))} density="console" locale={locale} />
              <Select
                label={t("cas06.addSuppliedBy")}
                name="supplied_by"
                options={data.suppliers.map((entry) => ({ value: entry.value, label: supplierLabel(entry) }))}
                value={typed("supplied_by")}
                placeholder={t("casops.choose")}
                required
                density="console"
                locale={locale}
              />
            </div>
            <ChoiceList
              legend={t("cas06.disclosure")}
              name="disclosure_status"
              options={DISCLOSURES.map((status) => ({ value: status, label: t(`casops.disclosure.${status}`), helper: t(`casops.disclosureHelp.${status}`) }))}
              {...(typed("disclosure_status") !== "" ? { value: typed("disclosure_status") } : {})}
              required
              {...field("disclosure", t("cas06.disclosure"))}
              density="console"
              locale={locale}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "var(--space-4)" }}>
            <RequiredSubmit
              variant="secondary"
              size="sm"
              reasons={[
                { field: "item_ref", text: t("cas06.needAddItem") },
                { field: "disclosure_status", text: t("cas06.needDisclosure") },
                { field: "supplied_by", text: t("cas06.needSupplier") },
              ]}
              locale={locale}
            >
              {t("cas06.add")}
            </RequiredSubmit>
          </div>
        </RequiredForm>
      </Disclosure>
    </Panel>
  );
}

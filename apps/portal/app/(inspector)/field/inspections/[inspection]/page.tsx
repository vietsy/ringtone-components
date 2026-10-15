import { Banner, Button, ButtonRow, Combobox, EmptyState, FactList, PageHeader, Panel, StatusLine, Table, TextField } from "@/components/r1";
import { abandonInspection, addFinding, attachToInspection, verifyForInspection } from "@/features/inspection/actions";
import { ConfirmButton } from "@/features/inspection/ConfirmButton";
import { FieldFailure, FieldFrame } from "@/features/inspection/FieldFrame";
import { RowActTable } from "@/features/inspection/RowActTable";
import { counted, date, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import {
  FINDING_KINDS,
  currentFieldDevice,
  loadInspection,
  type AttachedAnswer,
  type InspectionAttempt,
  type InspectionInProgress,
  type RefusalCode,
} from "@/lib/api/inspection";
import { readForPage } from "@/lib/api/flash";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER04_VIEWS } from "@/lib/mock/inspection";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const NO_ACTS: readonly RefusalCode[] = ["NO_EFFECTIVE_APPOINTMENT", "APPOINTMENT_SUSPENDED"];

/**
 * SCR-VER-04 Inspection in progress. The inspector verifies the premises' record and attaches the answers, records
 * what was found, then concludes the inspection, or abandons one opened in error while nothing is recorded yet.
 */
export default async function InspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ inspection: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Signed in as an inspector, or sent to sign in.
  const { sessionId } = await requireInspector();
  const [{ inspection }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, VER04_VIEWS);
  const attempt = readForPage<InspectionAttempt>(query);
  const outcome = view === "loading" ? null : await loadInspection(sessionId, inspection, view, locale, attempt);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // The dialog is open when the review asks for it, or when the abandonment it sent was refused.
  const abandonOpen = view === "abandon-confirm" || view === "abandon-reason-missing" || (view === null && attempt?.act === "abandon");

  return (
    <FieldFrame device={data?.device ?? currentFieldDevice()} locale={locale}>
      <PageHeader
        title={data !== null ? t("ver04.title", { ref: data.reference, premises: data.premises, authority: data.authorityCode }) : inspection}
        {...(data !== null
          ? {
              status:
                data.state === "OPEN"
                  ? { family: "info", label: t("ver04.open") }
                  : { family: "neutral", label: t(data.state === "CONCLUDED" ? "ver04.concluded" : "ver04.abandoned") },
              meta:
                data.purpose !== null
                  ? t("ver04.meta", { purpose: t(`ver.purpose.${data.purpose}`), t: timestamp(data.tookPlaceAt, locale) })
                  : t("ver04.metaNoPurpose", { t: timestamp(data.tookPlaceAt, locale) }),
            }
          : {})}
        size="public"
        locale={locale}
      />
      {failure !== null ? (
        <FieldFailure
          failure={failure}
          refusals={["INSPECTION_NOT_FOUND", "NOT_AUTHORISED"]}
          action={{ for: "INSPECTION_NOT_FOUND", label: t("ver.home"), href: routes.field(), icon: "arrow-left" }}
          t={t}
          locale={locale}
        />
      ) : (
        <Inspection data={data} reference={inspection} abandonOpen={abandonOpen} t={t} locale={locale} />
      )}
    </FieldFrame>
  );
}

function Inspection({
  data,
  reference,
  abandonOpen,
  t,
  locale,
}: {
  /** Null while the inspection is being read. */
  data: InspectionInProgress | null;
  reference: string;
  abandonOpen: boolean;
  t: Translate;
  locale: Locale;
}) {
  const refusal = data?.refusal ?? null;
  const offline = data?.device.network === "offline";
  const readAt = data?.device.readAt ?? null;
  // Concluded, or closed without a record: the inspection has ended and nothing more is recorded on it.
  const concluded = data !== null && data.state !== "OPEN";
  const blocked = refusal !== null && NO_ACTS.includes(refusal);
  const actsOff = offline || concluded || blocked;
  const actsWhy = offline ? t("ver04.offlineWhy") : blocked && refusal !== null ? refusalOf(t, refusal).title : null;
  const off = actsOff ? { disabled: true, ...(actsWhy !== null ? { disabledReason: actsWhy } : {}) } : {};
  const attached = data?.attached ?? [];
  const uploaded = data?.uploadedNotAttached ?? [];
  const findings = data?.findings ?? [];
  const nothingYet = attached.length === 0 && findings.length === 0;
  const titled = (label: string, count: number) => (count > 0 ? counted(t, label, count) : label);
  const draft = data?.draft ?? null;
  const noteRefusal = draft?.noteRefusal ?? null;
  const abandonWhy = !nothingYet ? refusalOf(t, "ABANDONMENT_NOT_PERMITTED").title : actsWhy;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      {offline && (
        <StatusLine
          family="info"
          text={t("ver.noNetworkTitle")}
          detail={`${t("ver.noNetwork")} ${readAt !== null ? t("ver.readAt", { t: timestamp(readAt, locale) }) : ""}`.trim()}
          locale={locale}
        />
      )}
      {refusal !== null && (
        <Banner
          family="attention"
          title={refusalOf(t, refusal).title}
          code={refusal}
          {...(refusal === "POLICY_READ_UNAVAILABLE"
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.fieldInspection(reference) } }
            : {})}
          density="portal"
          locale={locale}
        >
          {refusalOf(t, refusal).text}
        </Banner>
      )}
      {data !== null && !concluded && nothingYet && (
        <EmptyState variant="not-started" title={t("ver04.emptyTitle")} level={2} action={false} density="portal" locale={locale} />
      )}

      <Panel title={titled(t("ver04.attached"), attached.length)} level={2} inset="sm" density="portal" locale={locale}>
        <Table
          columns={[
            { key: "ans", label: t("ver04.cAnswer"), kind: "id" },
            { key: "res", label: t("ver04.cResult"), kind: "status" },
            { key: "at", label: t("ver04.cAt"), kind: "datetime" },
          ]}
          rows={attached.map((row) => attachedRow(row, t, locale))}
          loading={data === null ? 1 : false}
          layout="cards"
          density="portal"
          caption={titled(t("ver04.attached"), attached.length)}
          empty={{ variant: "not-started", title: t("ver04.noneAttached"), action: false }}
          locale={locale}
        />
        {/* SCR-VER-01 opens with this inspection named, so what is verified attaches to it. */}
        <form action={verifyForInspection.bind(null, reference)}>
          <Button
            type="submit"
            variant="secondary"
            size="md"
            icon="qr-code"
            fullWidth
            {...(data?.pastAppointmentEnd === true ? { disabled: true, disabledReason: t("ver04.lastDay") } : off)}
            locale={locale}
          >
            {t("ver04.verify")}
          </Button>
        </form>
      </Panel>

      {uploaded.length > 0 && (
        <Panel title={titled(t("ver04.uploaded"), uploaded.length)} level={2} inset="sm" density="portal" locale={locale}>
          <RowActTable
            columns={[
              { key: "ans", label: t("ver04.cAnswer"), kind: "id" },
              { key: "res", label: t("ver04.cResult"), kind: "status" },
              { key: "at", label: t("ver04.cChecked"), kind: "datetime" },
              { key: "act", kind: "actions" },
            ]}
            rows={uploaded.map((row) => ({
              key: row.answer,
              cells: {
                ...(row.refusal !== null ? { _message: { severity: "warning", text: refusalSentence(t, row.refusal), code: row.refusal } } : {}),
                ans: row.answer,
                res: { family: "info", label: t("ver.inForce"), variant: "seal" },
                at: row.checkedAt,
              },
              act: {
                label: t("ver04.attach"),
                ariaLabel: `${t("ver04.attach")} ${row.answer}`,
                icon: "plus",
                ...(offline ? { disabledReason: t("ver04.offlineWhy") } : {}),
              },
            }))}
            action={attachToInspection.bind(null, reference)}
            loading={false}
            caption={titled(t("ver04.uploaded"), uploaded.length)}
            locale={locale}
          />
        </Panel>
      )}

      <Panel title={titled(t("ver04.findings"), findings.length)} level={2} inset="sm" gap="lg" density="portal" locale={locale}>
        {findings.length > 0 && (
          <Table
            columns={[
              { key: "kind", label: t("ver04.cKind"), kind: "strong" },
              { key: "note", label: t("ver04.cNote") },
            ]}
            rows={findings.map((finding, i) => ({ _key: `${finding.kind}-${i}`, kind: t(`ver.finding.${finding.kind}`), note: finding.note }))}
            layout="cards"
            density="portal"
            caption={titled(t("ver04.findings"), findings.length)}
            locale={locale}
          />
        )}
        <form action={addFinding.bind(null, reference)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Combobox
            label={t("ver04.kind")}
            name="finding_kind"
            options={FINDING_KINDS.map((kind) => ({ value: kind, label: t(`ver.finding.${kind}`) }))}
            {...(draft !== null && draft.kind !== null ? { value: draft.kind } : {})}
            required
            wrap
            {...off}
            density="portal"
            locale={locale}
          />
          <TextField
            label={t("ver04.note")}
            name="note"
            value={draft?.note ?? ""}
            helper={t("ver04.noteHelp")}
            {...(noteRefusal !== null ? { error: refusalSentence(t, noteRefusal) } : {})}
            multiline
            rows={3}
            maxLength={2000}
            {...off}
            density="portal"
            locale={locale}
          />
          <Button type="submit" variant="secondary" size="md" icon="plus" fullWidth {...off} locale={locale}>
            {t("ver04.addFinding")}
          </Button>
        </form>
      </Panel>

      {concluded && (
        <>
          <Banner family="neutral" title={refusalOf(t, "INSPECTION_NOT_OPEN").title} code="INSPECTION_NOT_OPEN" density="portal" locale={locale}>
            {refusalOf(t, "INSPECTION_NOT_OPEN").text}
          </Banner>
          {data !== null && data.record !== null && (
            <Panel inset="sm" density="portal" locale={locale}>
              <FactList items={[{ label: t("ver.recordRef"), value: data.record, kind: "id" }]} locale={locale} />
            </Panel>
          )}
        </>
      )}

      <ButtonRow>
        {!concluded && (
          <>
            <Button variant="primary" size="lg" icon="arrow-right" fullWidth href={routes.fieldConclude(reference)} {...off} locale={locale}>
              {t("ver04.conclude")}
            </Button>
            <ConfirmButton
              trigger={{
                label: t("ver04.abandon"),
                variant: "secondary",
                size: "md",
                icon: "x",
                ...(actsOff || !nothingYet ? (abandonWhy !== null ? { disabledReason: abandonWhy } : {}) : {}),
              }}
              dialog={{
                title: t("ver04.dlgTitle"),
                description: t("ver04.dlgText"),
                primary: { label: t("ver04.abandon"), variant: "danger" },
                secondaryLabel: t("ver04.dlgBack"),
              }}
              defaultOpen={abandonOpen}
              action={abandonInspection.bind(null, reference)}
              locale={locale}
            >
              <TextField
                label={t("ver04.reason")}
                name="reason"
                value={data?.abandon.reason ?? ""}
                {...(data !== null && data.abandon.refusal !== null ? { error: refusalSentence(t, data.abandon.refusal) } : {})}
                multiline
                rows={3}
                required
                maxLength={1000}
                density="portal"
                locale={locale}
              />
            </ConfirmButton>
          </>
        )}
        <Button variant="quiet" size="md" icon="arrow-left" fullWidth href={routes.field()} locale={locale}>
          {t("ver.home")}
        </Button>
      </ButtonRow>
    </div>
  );
}

/** One attached answer: in force with the seal, refused at attaching, or waiting on the phone with its printed state. */
function attachedRow(row: AttachedAnswer, t: Translate, locale: Locale): Record<string, unknown> {
  const base = { _key: row.answer, ans: row.answer, at: row.readAt };
  switch (row.result.kind) {
    case "IN_FORCE":
      return { ...base, res: { family: "info", label: t("ver.inForce"), variant: "seal" } };
    case "SUSPENDED":
      return { ...base, res: { family: "attention", label: t("ver02.suspended") } };
    case "NO_CURRENT_RECORD":
      return { ...base, res: { family: "neutral", label: t("ver04.noCurrent") } };
    case "NOT_ATTACHED":
      return {
        ...base,
        res: { family: "neutral", label: t("ver04.notAttached") },
        _message: { severity: "warning", text: refusalSentence(t, row.result.refusal), code: row.result.refusal },
      };
    case "WAITING_OFFLINE":
      return {
        ...base,
        res: {
          family: "info",
          label: t("ver04.waiting"),
          detail: t("ver04.printedState", { d: date(row.result.printedOn, locale), s: t("ver.inForce") }),
        },
      };
  }
}

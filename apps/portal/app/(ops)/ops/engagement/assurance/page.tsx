import { Banner, Button, ButtonRow, DateField, PageHeader, Pagination, Panel, Skeleton, Table, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { count, derived, engTranslator, fieldParts, moment, readInstant, refusalSentence, rowWords, signed } from "@/features/engagement/copy";
import { LoadFailure } from "@/features/engagement/Refusals";
import { loadAssuranceBalance, loadEngagementAudit, type AuditEntry, type BalanceView } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim() : "");

/** The audit log rows the page shows beside the read, newest first. */
const LOG_ROWS = 20;

/**
 * The assurance read of `GET /engagement/balance/as-at` (`PERM-136`, `PERM-138`), for the auditor (ACT-AUD): a
 * participant's balance and history as at a past instant, reproduced from the ledger events alone, under the assurance
 * engagement the auditor names. ENG's inventory gives this read no screen of its own (SCR-ENG-02 is the participant's),
 * so it sits in the engagement workspace with SCR-ENG-02's figure sentence and history. The instant is exclusive of
 * everything recorded after it, corrections included; a future one is refused beside its field naming the latest that
 * may be asked (`AC-FR-ENG-014-04`). Every read, answered or refused, is a row of `marketplace.audit_log`, and the log
 * is shown beneath it, so the reader sees the row their read wrote.
 */
export default async function AssurancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const failing = view === "error" ? view : null;
  const participant = text(params.participant);
  const engagement = text(params.engagement);
  const asAtRaw = text(params.as_at);
  // The instant as the date field sends it, or as a page link carries it (ISO).
  const asAt = readInstant(asAtRaw) ?? (asAtRaw !== "" && !Number.isNaN(Date.parse(asAtRaw)) ? asAtRaw : null);
  const asked = participant !== "" || engagement !== "" || asAtRaw !== "";
  const complete = participant !== "" && engagement !== "" && asAt !== null;
  const outcome = view === "loading" || !complete ? null : await loadAssuranceBalance(staff, { participant, engagement, asAt }, text(params.after) || null, failing);
  // Read after the balance, so the row this read wrote is on it.
  const log = view === "loading" ? null : await loadEngagementAudit(staff, failing);
  const future = outcome?.failure?.code === "AS_AT_IN_FUTURE" ? { latest: outcome.named?.latest ?? null } : null;
  const missing = asked && !complete ? { participant: participant === "", engagement: engagement === "", asAt: asAt === null } : null;

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("engHome.title"), href: routes.opsEngagement() }]} title={t("engAssure.title")} meta={t("engAssure.meta")} locale={locale} />
        <Ask participant={participant} engagement={engagement} asAt={asAt} missing={missing} future={future} t={t} locale={locale} />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="table" rows={5} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure?.code === "CAPABILITY_WITHHELD" ? (
          <Banner family="info" title={t("engAssure.withheld")} density="console" locale={locale}>
            {t("engAssure.withheldText")}
          </Banner>
        ) : outcome?.failure && future === null ? (
          <LoadFailure failure={outcome.failure} errTitle={t("engAssure.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" />
        ) : null}
        {outcome?.data ? <Reconstructed data={outcome.data} asked={{ participant, engagement }} t={t} locale={locale} /> : null}
        {log?.failure ? <LoadFailure failure={log.failure} errTitle={t("engAssure.logErr")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {log?.data ? <AuditLog rows={log.data.slice(0, LOG_ROWS)} total={log.data.length} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** The participant, the engagement and the instant, all three asked before anything is read. */
function Ask({
  participant,
  engagement,
  asAt,
  missing,
  future,
  t,
  locale,
}: {
  participant: string;
  engagement: string;
  asAt: string | null;
  missing: { participant: boolean; engagement: boolean; asAt: boolean } | null;
  future: { latest: string | null } | null;
  t: Translate;
  locale: Locale;
}) {
  const parts = fieldParts(asAt);
  const refusal = future !== null ? `${refusalSentence("AS_AT_IN_FUTURE", t)}${future.latest !== null ? ` ${t("eng.named.latest", { ts: moment(future.latest, locale) })}` : ""}` : null;
  return (
    <Panel title={t("engAssure.askTitle")} level={2} density="console" locale={locale}>
      <form action={routes.opsEngagementAssurance()} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <TextField
          label={t("engAssure.participant")}
          helper={t("engAssure.participantHelp")}
          name="participant"
          value={participant}
          mono
          required
          {...(missing?.participant === true ? { error: t("engAssure.participantMissing") } : {})}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
        <TextField
          label={t("engAssure.engagement")}
          helper={t("engAssure.engagementHelp")}
          name="engagement"
          value={engagement}
          mono
          required
          {...(missing?.engagement === true ? { error: t("engAssure.engagementMissing") } : {})}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
        <DateField
          label={t("engAssure.asAt")}
          helper={t("engAssure.asAtHelp")}
          name="as_at"
          {...(parts.date !== "" ? { value: parts.date, time: parts.time } : {})}
          withTime
          required
          {...(refusal !== null ? { error: refusal } : missing?.asAt === true ? { error: t("engAssure.asAtMissing") } : {})}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
        <Text size="sm" weight="medium">
          {t("engAssure.recorded")}
        </Text>
        <ButtonRow>
          <Button type="submit" variant="primary" size="sm" icon="search" locale={locale}>
            {t("engAssure.read")}
          </Button>
          <Button variant="quiet" size="sm" href={routes.opsEngagementAssurance()} locale={locale}>
            {t("engAssure.clear")}
          </Button>
        </ButtonRow>
      </form>
    </Panel>
  );
}

/** The balance as at the instant, said to be derived, and the events up to the cut-off it was computed at. */
function Reconstructed({ data, asked, t, locale }: { data: BalanceView; asked: { participant: string; engagement: string }; t: Translate; locale: Locale }) {
  const page = (after: string | null) => routes.opsEngagementAssurance({ ...asked, asAt: data.computedAt, after });
  return (
    <Panel title={t("engAssure.figureTitle", { ts: moment(data.computedAt, locale) })} level={2} compact density="console" locale={locale}>
      <Text size="base" weight="semibold">
        {derived(data.points, data.eventCount, t, locale)}
      </Text>
      <Text size="sm" tone="secondary">
        {t("engAssure.cutOff", { ts: moment(data.computedAt, locale), ref: asked.participant.toUpperCase(), engagement: asked.engagement })}
      </Text>
      {data.negative ? <Text size="sm">{t("eng02.negative")}</Text> : null}
      <Table
        columns={[
          { key: "recorded", label: t("eng02.cDate"), kind: "datetime" },
          { key: "what", label: t("eng02.cWhat"), kind: "stack" },
          { key: "points", label: t("eng02.cPoints"), kind: "stack", align: "end" },
        ]}
        rows={data.history.rows.map((row) => ({
          _key: row.id,
          recorded: row.recordedAt,
          what: {
            text: rowWords(row, t, locale),
            detail: row.correctedBy !== null ? t("eng02.correctedOn", { d: moment(row.correctedBy.recordedAt, locale) }) : row.kind === "correction" ? t("eng02.isCorrection") : row.id,
          },
          points: { text: signed(row.points, locale), detail: t(row.points < 0 ? "eng02.minus" : "eng02.plus"), num: true },
        }))}
        density="console"
        caption={t("engAssure.historyTitle")}
        empty={{ variant: "governed", title: t("engAssure.empty"), action: false }}
        locale={locale}
      />
      {data.history.total > 0 ? (
        <Pagination
          summary={t("eng.showing", { shown: count(data.history.shownTo, locale), total: count(data.history.total, locale) })}
          hasNext={data.history.next !== null}
          {...(data.history.next !== null ? { nextHref: page(data.history.next) } : {})}
          hasPrev={data.history.shownTo > data.history.rows.length}
          {...(data.history.shownTo > data.history.rows.length ? { firstHref: page(null) } : {})}
          density="console"
          locale={locale}
        />
      ) : null}
    </Panel>
  );
}

/** `marketplace.audit_log`, newest first: every read and every refused attempt, by whom and with what answer. */
function AuditLog({ rows, total, t, locale }: { rows: readonly AuditEntry[]; total: number; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("engAssure.logTitle")} level={2} compact density="console" locale={locale}>
      <Table
        columns={[
          { key: "at", label: t("engAssure.cAt"), kind: "datetime" },
          { key: "actor", label: t("engAssure.cActor") },
          { key: "act", label: t("engAssure.cAct"), kind: "mono" },
          { key: "subject", label: t("engAssure.cSubject"), kind: "mono" },
          { key: "answer", label: t("engAssure.cAnswer"), kind: "stack" },
        ]}
        rows={rows.map((row, index) => ({
          _key: `${row.at}-${String(index)}`,
          at: row.at,
          actor: row.actor,
          act: row.act,
          subject: row.subject,
          answer: { text: row.code ?? t("engAssure.answered"), ...(row.detail !== null ? { detail: row.detail } : {}), mono: row.code !== null },
        }))}
        density="console"
        caption={t("engAssure.logTitle")}
        footer={t("eng.showing", { shown: count(rows.length, locale), total: count(total, locale) })}
        empty={{ variant: "governed", title: t("engAssure.logEmpty"), action: false }}
        locale={locale}
      />
    </Panel>
  );
}

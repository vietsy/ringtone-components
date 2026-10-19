import { Button, ButtonRow, PageHeader, Pagination, Panel, Skeleton, Table, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { supportReadAct } from "@/features/engagement/actions";
import { count, day, derived, engTranslator, moment, participationStatus, rowWords, signed } from "@/features/engagement/copy";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { readForPage } from "@/lib/api/flash";
import { loadSupportView, type EngagementAttempt, type SupportViewData } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-ENG-10 Participant balance for support. No board or Figma frame draws it: it is built from ENG's specification
 * and wireframe. The purpose is asked before the read, with *this read is recorded against you* above the control,
 * never after; the read then shows whose record it is, the same derived figure the participant sees and their history.
 * An event selected here is the only way to SCR-ENG-09, so a correction is proposed by someone who has seen what else
 * the participant holds.
 */
export default async function SupportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const read = text(params.read);
  const outcome = read === null || view === "loading" ? null : await loadSupportView(staff, read, text(params.after), text(params.event), view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept?.page === "eng10" ? kept : null;
  const data = outcome?.data ?? null;

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("engHome.title"), href: routes.opsEngagement() }]} title={t("eng10.title")} locale={locale} />
        {attempt?.refusal && attempt.refusal.code !== "FIELD_MISSING" ? <RefusalBanner refusal={attempt.refusal} t={t} locale={locale} density="console" /> : null}
        <Find attempt={attempt} data={data} t={t} locale={locale} />
        {read !== null && view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="table" rows={5} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng10.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {data !== null ? <Read data={data} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** The participant and the purpose, the purpose required before anything is read. */
function Find({ attempt, data, t, locale }: { attempt: EngagementAttempt | null; data: SupportViewData | null; t: Translate; locale: Locale }) {
  const field = attempt?.refusal?.code === "FIELD_MISSING" ? String(attempt.refusal.values.field ?? "") : null;
  const participant = attempt?.form.participant ?? data?.participant.ref ?? "";
  const purpose = attempt?.form.purpose ?? data?.read.purpose ?? "";
  return (
    <Panel title={t("eng10.findTitle")} level={2} density="console" locale={locale}>
      <form action={supportReadAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <TextField
          label={t("eng10.participant")}
          helper={t("eng10.participantHelp")}
          name="participant"
          value={participant}
          mono
          required
          {...(field === "participant" ? { error: participant.trim() === "" ? t("eng10.participantMissing") : t("eng10.participantUnknown") } : {})}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
        <TextField
          label={t("eng10.purpose")}
          helper={t("eng10.purposeHelp")}
          name="purpose"
          value={purpose}
          required
          maxLength={500}
          {...(field === "purpose" ? { error: t("eng10.purposeMissing") } : {})}
          density="console"
          width="var(--container-lg)"
          locale={locale}
        />
        <Text size="sm" weight="medium">
          {t("eng10.recorded")}
        </Text>
        <ButtonRow>
          <Button type="submit" variant="primary" size="sm" icon="search" locale={locale}>
            {t("eng10.find")}
          </Button>
        </ButtonRow>
      </form>
    </Panel>
  );
}

function Read({ data, t, locale }: { data: SupportViewData; t: Translate; locale: Locale }) {
  const read = data.read.id;
  const selected = data.selected;
  return (
    <Panel
      title={data.participant.name}
      level={2}
      {...(data.participation !== null ? { status: participationStatus(data.participation.state, t) } : {})}
      compact
      density="console"
      locale={locale}
    >
      <Text size="sm" tone="secondary">
        {t("eng10.readMeta", { ref: data.participant.ref, purpose: data.read.purpose, ts: moment(data.read.at, locale) })}
      </Text>
      <Text size="base" weight="semibold">
        {derived(data.points, data.eventCount, t, locale)}
      </Text>
      {data.participation?.enrolledAt ? (
        <Text size="sm" tone="secondary">
          {t("eng10.enrolled", { d: day(data.participation.enrolledAt, locale) })}
        </Text>
      ) : null}
      <Table
        columns={[
          { key: "recorded", label: t("eng02.cDate"), kind: "datetime" },
          { key: "what", label: t("eng02.cWhat"), kind: "stack" },
          { key: "points", label: t("eng02.cPoints"), kind: "stack", align: "end" },
          { key: "open", label: t("eng02.cOpen"), kind: "actions" },
        ]}
        rows={data.history.rows.map((row) => ({
          _key: row.id,
          _href: routes.opsEngagementSupport({ read, event: row.id }),
          ...(row.id === selected?.id ? { _selected: true } : {}),
          recorded: row.recordedAt,
          what: {
            text: rowWords(row, t, locale),
            detail: row.correctedBy !== null ? t("eng02.correctedOn", { d: moment(row.correctedBy.recordedAt, locale) }) : row.kind === "correction" ? t("eng02.isCorrection") : row.id,
          },
          points: { text: signed(row.points, locale), detail: t(row.points < 0 ? "eng02.minus" : "eng02.plus"), num: true },
          open: [{ label: t("eng02.open"), ariaLabel: t("eng02.openAria", { event: row.id }), href: routes.opsEngagementEvent(row.id, read), variant: "quiet" as const }],
        }))}
        density="console"
        rowFocus
        caption={t("eng10.historyTitle")}
        empty={{ variant: "governed", title: t("eng10.empty"), action: false }}
        locale={locale}
      />
      {data.history.total > 0 ? (
        <Pagination
          summary={t("eng.showing", { shown: count(data.history.shownTo, locale), total: count(data.history.total, locale) })}
          hasNext={data.history.next !== null}
          {...(data.history.next !== null ? { nextHref: routes.opsEngagementSupport({ read, after: data.history.next }) } : {})}
          hasPrev={data.history.shownTo > data.history.rows.length}
          {...(data.history.shownTo > data.history.rows.length ? { firstHref: routes.opsEngagementSupport({ read }) } : {})}
          density="console"
          locale={locale}
        />
      ) : null}
      <ButtonRow align="between">
        <Button variant="secondary" size="sm" href={routes.opsEngagementSupport()} locale={locale}>
          {t("eng10.clear")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          {...(selected !== null ? { href: routes.opsCorrectionNew(read, selected.id) } : { disabled: true, disabledReason: t("eng10.selectFirst") })}
          locale={locale}
        >
          {selected !== null ? t("eng10.correctThis", { event: selected.id }) : t("eng10.correct")}
        </Button>
      </ButtonRow>
    </Panel>
  );
}

import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  ChoiceList,
  Columns,
  DateField,
  Disclosure,
  Divider,
  EmptyState,
  FilterBar,
  ItemList,
  Link,
  PageHeader,
  Panel,
  ScheduleGrid,
  Select,
  StatusBadge,
  TimeField,
  ViewState,
  type SlotKind,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { addSchedule, showWeek } from "@/features/venue/actions";
import { day, daysWords, overlapNote, periodOutcome, playlistStatus, refusalWords, venTranslator } from "@/features/venue/copy";
import { LoadError, RefusalBanner, RefusedBody, VenueShell } from "@/features/venue/Frame";
import { ListPager } from "@/features/venue/ListPager";
import { PeriodsByDay, type DayPeriods } from "@/features/venue/PeriodsByDay";
import { ScheduleTable, type ScheduleTableRow } from "@/features/venue/ScheduleTable";
import { SubmitButton } from "@/features/venue/SubmitButton";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadSchedule, type ResolvedPeriod, type ScheduleAttempt, type ScheduleRow, type ScheduleStep, type WeekQuery } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN08_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VEN-08 Weekly schedule. The schedules saved, the form that adds one, and what will actually play in each
 * period of a week and why: the resolved schedule, not only the inputs. The week and the as-at instant are visible
 * values the person can change (convention 5); every time is Vietnam time.
 */
export default async function SchedulePage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN08_VIEWS);
  const week: WeekQuery | null =
    typeof query.from === "string" && typeof query.to === "string" && typeof query.as_of === "string" ? { from: query.from, to: query.to, asOf: query.as_of } : null;
  const after = typeof query.after === "string" ? query.after : null;
  const outcome = view === "loading" ? null : await loadSchedule(principal, service, week, view, after);
  const last = readForPage<ScheduleAttempt>(query);
  const attempt = last?.page === "schedule" && last.service === service ? last : null;
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={step !== null ? { premises: step.service.premises.name, period: step.service.code } : null}>
      <PageHeader
        crumbs={[
          { label: t("ven.crumb"), href: routes.player() },
          ...(step !== null ? [{ label: step.service.premises.name, href: routes.playerService(service) }] : []),
        ]}
        title={t("ven08.title")}
        meta={t("ven.vnTime")}
        locale={locale}
      />
      {view === "loading" ? <ViewState view="loading" skeleton="table" rows={7} density="portal" locale={locale} /> : null}
      {failure !== null && failure.code === "NOT_AUTHORISED_FOR_PREMISES" ? (
        <RefusedBody code={failure.code} back={{ label: t("ven.backServices"), href: routes.player() }} t={t} locale={locale} />
      ) : failure !== null ? (
        <LoadError failure={failure} locale={locale} />
      ) : null}
      {step !== null ? <Schedule step={step} attempt={attempt} asked={week} frame={frame} t={t} locale={locale} /> : null}
      {failure?.code !== "NOT_AUTHORISED_FOR_PREMISES" ? (
        <div>
          <Link back href={routes.playerService(service)} variant="standalone" size="touch" locale={locale}>
            {t("ven.backService")}
          </Link>
        </div>
      ) : null}
    </VenueShell>
  );
}

/** The fields a save refusal is said beside; the others go in the form's header. */
const FIELD_CODES: ReadonlySet<string> = new Set(["PLAYLIST_NO_ELIGIBLE_TRACK", "PLAYLIST_ARCHIVED", "INVALID_TIME_RANGE", "NO_DAYS", "EFFECTIVE_FROM_IN_PAST", "SCHEDULE_NOT_ACTIVE"]);

function Schedule({
  step,
  attempt,
  asked,
  frame,
  t,
  locale,
}: {
  step: ScheduleStep;
  attempt: ScheduleAttempt | null;
  /** The week in the address, which a page of the schedules keeps. */
  asked: WeekQuery | null;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const code = step.service.code;
  const mutable = step.service.status === "PENDING_TERMS" || step.service.status === "ACTIVE";
  const pending = step.service.status === "PENDING_TERMS";
  const fallback = step.defaultPlaylist;
  const form = attempt !== null && attempt.schedule === null ? attempt : null;
  const fieldError = (field: ScheduleAttempt["field"]) => (form !== null && form.field === field && FIELD_CODES.has(form.code) ? t(`ven.refusal.${form.code}`) : null);
  const formHeader = form !== null && (form.field === null || !FIELD_CODES.has(form.code)) ? form.code : null;
  // Replaces offers every schedule in force, on whichever page of the list it falls.
  const active = step.replaceable;

  return (
    <>
      {!mutable ? <RefusalBanner code="ENTITLEMENT_NOT_ACTIVE" t={t} locale={locale} /> : null}
      <Panel layout={phone ? "stack" : "strip"} inset={inset} density="portal" locale={locale}>
        <Text size="base" tone="secondary">
          {t("ven08.defaultLabel")}
        </Text>
        {fallback !== null ? (
          <>
            <Text size="lg" weight="semibold">
              {fallback.name}
            </Text>
            <StatusBadge {...playlistStatus(fallback.status, t)} size="sm" />
            <Text size="base" tone="secondary">
              {t("ven08.defaultNote")}
            </Text>
          </>
        ) : (
          <Text size="base">{t("ven06.noDefault")}</Text>
        )}
        <Link href={routes.playerPlaylists(code)} variant="standalone" size="touch" locale={locale}>
          {t("ven08.change")}
        </Link>
      </Panel>
      <Panel gap="xl" inset={inset} density="portal" locale={locale}>
        <Panel variant="plain" level={2} title={t("ven08.schedTitle")} density="portal" locale={locale}>
          {step.schedules.length === 0 ? (
            <EmptyState variant="governed" title={t("ven08.noSchedTitle")} level={3} action={false} density="portal" locale={locale} />
          ) : (
            <ScheduleTable
              service={code}
              rows={step.schedules.map((schedule) => scheduleRow(schedule, attempt, t, locale))}
              copy={{
                caption: t("ven08.schedTitle"),
                playlist: t("ven08.cList"),
                when: t("ven08.cWhen"),
                from: t("ven08.cFrom"),
                saved: t("ven08.cSaved"),
                state: t("ven08.cState"),
                withdraw: t("ven08.withdraw"),
                dialogTitle: t("ven08.dlgTitle"),
                dialogText: t("ven08.dlgText"),
                reason: t("ven06.reason"),
                reasonHelp: t("ven06.reasonHelp"),
                confirm: t("ven08.dlgYes"),
                keep: t("ven08.dlgNo"),
              }}
              phone={phone}
              locale={locale}
            />
          )}
          <ListPager paging={step.schedulesPaging} href={(cursor) => routes.playerSchedule(code, asked ?? undefined, cursor)} density="portal" t={t} locale={locale} />
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("ven08.addTitle")} gap="lg" density="portal" locale={locale}>
          {formHeader !== null ? <RefusalBanner code={formHeader} family="attention" level={3} t={t} locale={locale} /> : null}
          <form action={addSchedule.bind(null, code)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Columns layout="quarters" single={phone}>
              <div style={{ gridColumn: "1 / -1", minWidth: 0, maxWidth: "var(--container-md)" }}>
                <Select
                  label={t("ven08.fList")}
                  name="playlist_id"
                  options={step.usable.map((playlist) => ({ value: playlist.id, label: playlist.name }))}
                  {...(form !== null && form.values.playlist !== "" ? { value: form.values.playlist } : {})}
                  placeholder={t("ven08.fListPh")}
                  {...(fieldError("playlist") !== null ? { error: fieldError("playlist") ?? "" } : {})}
                  required
                  density="portal"
                  locale={locale}
                />
              </div>
              <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
                <ChoiceList
                  legend={t("ven08.fDays")}
                  name="days_of_week"
                  required
                  multiple
                  options={[1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ value: String(weekday), label: t(`ven.dayShort.${weekday}`) }))}
                  value={(form?.values.days ?? []).map(String)}
                  {...(fieldError("days") !== null ? { error: fieldError("days") ?? "" } : {})}
                  layout="chips"
                  density="portal"
                  locale={locale}
                />
              </div>
              <TimeField label={t("ven08.fStart")} name="start_local" value={form?.values.start ?? ""} required density="portal" locale={locale} />
              <TimeField
                label={t("ven08.fEnd")}
                name="end_local"
                value={form?.values.end ?? ""}
                helper={t("ven08.endHelp")}
                endOfDay
                required
                {...(fieldError("end") !== null ? { error: fieldError("end") ?? "" } : {})}
                density="portal"
                locale={locale}
              />
              <DateField
                label={t("ven08.fFrom")}
                name="effective_from"
                value={form?.values.from ?? ""}
                helper={t("ven08.fromHelp")}
                {...(fieldError("from") !== null ? { error: fieldError("from") ?? "" } : {})}
                density="portal"
                locale={locale}
              />
              <DateField label={t("ven08.fTo")} name="effective_to" value={form?.values.to ?? ""} placeholder={t("ven08.openEnded")} helper={t("ven08.toHelp")} density="portal" locale={locale} />
              <div style={{ gridColumn: "1 / -1", minWidth: 0, maxWidth: "var(--container-xl)" }}>
                <Select
                  label={t("ven08.fReplaces")}
                  name="supersedes_schedule_id"
                  helper={t("ven08.replacesHelp")}
                  options={[
                    { value: "none", label: t("ven08.replacesNone") },
                    ...active.map((schedule) => ({ value: schedule.id, label: t("ven08.replacesOption", { playlist: schedule.playlist, days: daysWords(schedule.days, t, true), time: `${schedule.start}-${schedule.end}` }) })),
                  ]}
                  value={form?.values.replaces !== undefined && form.values.replaces !== "" ? form.values.replaces : "none"}
                  {...(fieldError("replaces") !== null ? { error: fieldError("replaces") ?? "" } : {})}
                  density="portal"
                  locale={locale}
                />
              </div>
            </Columns>
            <div style={{ display: "flex" }}>
              <SubmitButton
                variant="primary"
                size="md"
                fullWidth={phone}
                disabled={!mutable}
                {...(!mutable ? { disabledReason: refusalWords("ENTITLEMENT_NOT_ACTIVE", t).title } : {})}
                locale={locale}
              >
                {t("ven08.add")}
              </SubmitButton>
            </div>
          </form>
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("ven08.playsTitle")} actions={[{ kind: "link", label: t("ven08.fallbacks"), href: routes.playerFallbacks(code) }]} gap="lg" density="portal" locale={locale}>
          {pending ? (
            <Banner family="info" title={t("ven08.pendTitle")} level={3} density="portal" action={{ label: t("ven08.accept"), href: routes.playerTerms(code), variant: "secondary" }} locale={locale}>
              {t("ven08.pendText")}
            </Banner>
          ) : null}
          <Week step={step} frame={frame} t={t} locale={locale} />
          {/* RULES_NOT_APPROVED replaces the disclosure as it replaces the week: no baseline is in force to disclose. */}
          {step.resolution.refusal !== "RULES_NOT_APPROVED" ? <Divider /> : null}
          {step.resolution.refusal !== "RULES_NOT_APPROVED" ? (
            <Disclosure title={t("ven08.how")} level={3} locale={locale}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingTop: "var(--space-2)" }}>
                <ItemList items={[1, 2, 3, 4].map((n) => ({ key: `r${n}`, title: t(`ven08.rule.${n}`) }))} readOnly density="portal" label={t("ven08.how")} locale={locale} />
                {step.rules !== null ? (
                  <Text size="base" tone="secondary">
                    {t("ven08.rulesSince", { d: day(step.rules.effectiveFrom, locale) })}
                  </Text>
                ) : null}
              </div>
            </Disclosure>
          ) : null}
        </Panel>
      </Panel>
    </>
  );
}

function scheduleRow(schedule: ScheduleRow, attempt: ScheduleAttempt | null, t: Translate, locale: Locale): ScheduleTableRow {
  const status =
    schedule.status === "ACTIVE"
      ? { family: "neutral" as const, label: t("ven08.sActive") }
      : schedule.status === "WITHDRAWN"
        ? { family: "neutral" as const, label: t("ven08.sWithdrawn"), ...(schedule.withdrawnAt !== null ? { detail: day(schedule.withdrawnAt, locale) } : {}) }
        : { family: "neutral" as const, label: t("ven08.sSuperseded") };
  const note = schedule.replaces !== null ? t("ven08.replacesNote", { d: day(`${schedule.replaces}T12:00:00+07:00`, locale) }) : schedule.playlistUnusable ? t("ven08.lostNote") : null;
  return {
    id: schedule.id,
    playlist: schedule.playlist,
    note,
    days: daysWords(schedule.days, t),
    daysInSentence: daysWords(schedule.days, t, true),
    time: `${schedule.start}-${schedule.end}`,
    from: schedule.effectiveFrom,
    saved: schedule.savedAt,
    status,
    active: schedule.status === "ACTIVE",
    refusal: attempt !== null && attempt.schedule === schedule.id ? { text: t(`ven.refusal.${attempt.code}`), code: attempt.code } : null,
  };
}

/** The resolved week: the window and the as-at instant, the grid on a desktop, and every period of a chosen day. */
function Week({ step, frame, t, locale }: { step: ScheduleStep; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const refusal = step.resolution.refusal;
  const periods = step.resolution.periods;
  const [asDate, asTime] = step.week.asOf.split("T");
  const byDay = new Map<string, ResolvedPeriod[]>();
  for (const period of periods ?? []) byDay.set(period.date, [...(byDay.get(period.date) ?? []), period]);
  const dates = [...byDay.keys()];
  const nothing = (periods ?? []).filter((period) => period.outcome === "NO_PLAYABLE_SCHEDULE").length;
  const today = step.today;
  const weekday = (date: string) => {
    const index = new Date(`${date}T00:00:00Z`).getUTCDay();
    return index === 0 ? 7 : index;
  };
  const dayLabel = (date: string) => `${t(`ven.day.${weekday(date)}`)}, ${(R1_FORMAT.formatStamp(`${date}T12:00:00+07:00`, locale) ?? "").split(",")[0] ?? ""}`;
  const days: DayPeriods[] = dates.map((date) => ({
    date,
    short: t(`ven.dayShort.${weekday(date)}`),
    label: dayLabel(date),
    rows: (byDay.get(date) ?? []).map((period) => ({
      key: `${date}-${period.start}`,
      time: `${period.start}-${period.end}`,
      // The revision in force when the period began, so a past period names the list it played then (FR-VEN-015).
      playlist: period.playlist === null ? "–" : period.revision === null ? period.playlist : `${period.playlist}, ${t("ven06.revision", { n: String(period.revision) })}`,
      note: overlapNote(period, t),
      outcome: periodOutcome(period, t),
    })),
  }));
  return (
    <>
      <form action={showWeek.bind(null, step.service.code)}>
        <FilterBar label={t("ven08.weekBar")} locale={locale}>
          <DateField
            range
            label={t("ven08.week")}
            fromLabel={t("ven08.wFrom")}
            toLabel={t("ven08.wTo")}
            name="week"
            value={step.week.from}
            to={step.week.to}
            {...(refusal === "WINDOW_TOO_LONG" ? { error: t("ven.refusal.WINDOW_TOO_LONG") } : {})}
            required
            density="portal"
            locale={locale}
          />
          <DateField
            withTime
            label={t("ven08.asOf")}
            name="as_of"
            value={asDate ?? ""}
            time={asTime ?? ""}
            {...(refusal === "AS_OF_REQUIRED" ? { error: t("ven.refusal.AS_OF_REQUIRED") } : {})}
            required
            density="portal"
            locale={locale}
          />
          <SubmitButton variant="secondary" size="md" locale={locale}>
            {t("ven08.show")}
          </SubmitButton>
        </FilterBar>
      </form>
      <Text size="base" tone="secondary">
        {t("ven08.asOfHelp")}
      </Text>
      {refusal === "RULES_NOT_APPROVED" ? <RefusalBanner code="RULES_NOT_APPROVED" level={3} t={t} locale={locale} /> : null}
      {periods !== null ? (
        <>
          {nothing > 0 ? (
            <Banner
              family="danger"
              title={t("ven08.npTitle", { n: R1_FORMAT.formatCount(nothing, locale) ?? String(nothing) })}
              level={3}
              density="portal"
              {...(step.defaultPlaylist !== null
                ? { action: { label: t("ven08.npOpen", { name: step.defaultPlaylist.name }), href: routes.playerPlaylist(step.service.code, step.defaultPlaylist.id), variant: "secondary" as const } }
                : {})}
              locale={locale}
            >
              {t("ven08.npText")}
            </Banner>
          ) : null}
          {!phone ? (
            <>
              <ScheduleGrid
                days={dates.map((date) => ({
                  label: dayLabel(date),
                  current: date === today,
                  segments: (byDay.get(date) ?? []).map((period) => segment(period, t)),
                }))}
                kinds={{
                  scheduled: t("ven08.kScheduled"),
                  default: step.defaultPlaylist !== null ? t("ven08.kDefault", { name: step.defaultPlaylist.name }) : t("ven08.kDefaultNone"),
                  fallback: t("ven08.kFallback"),
                  none: t("ven08.kNone"),
                }}
                caption={t("ven08.gridCaption")}
                locale={locale}
              />
              <Divider />
            </>
          ) : null}
          {days.length > 0 ? (
            <PeriodsByDay
              days={days}
              initial={dates.includes(today) ? today : (dates[0] ?? "")}
              copy={{ periodsOf: t("ven08.periodsOf"), time: t("ven08.pTime"), playlist: t("ven08.pList"), outcome: t("ven08.pOutcome") }}
              phone={phone}
              locale={locale}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** A period as the week grid draws it: its kind, and its words where the stretch has room for them. */
function segment(period: ResolvedPeriod, t: Translate) {
  const kind: SlotKind =
    period.outcome === "SCHEDULED" ? "scheduled" : period.outcome === "NO_PLAYABLE_SCHEDULE" ? "none" : period.reason === "NO_SCHEDULE_MATCHES" ? "default" : "fallback";
  const hours = (Number(period.end.split(":")[0]) * 60 + Number(period.end.split(":")[1]) - Number(period.start.split(":")[0]) * 60 - Number(period.start.split(":")[1])) / 60;
  const words = kind === "scheduled" ? (period.playlist ?? "") : kind === "none" ? t("ven08.kNoneShort") : kind === "default" ? t("ven08.kDefaultShort") : (period.lost ?? "");
  const room = kind === "default" || kind === "none" ? hours >= 4 : hours >= 3;
  const title = kind === "fallback" ? t("ven08.lostTitle", { lost: period.lost ?? "", playlist: period.playlist ?? "" }) : (period.playlist ?? words);
  return { from: period.start, to: period.end, kind, label: room ? words : "", title };
}

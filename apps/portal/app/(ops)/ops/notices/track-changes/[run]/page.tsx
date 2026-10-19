import { Banner, Button, ButtonRow, FactList, Panel, Skeleton, StatStrip, Table, Toast, ViewState } from "@/components/r1";
import { ConfirmAct } from "@/features/notices/ConfirmAct";
import { continueRunAct } from "@/features/notices/console-actions";
import { moment, noticeStateValue, runStateValue, tabRoles } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadTrackChangeRun, type ConsoleAttempt, type TrackChangeRunView } from "@/lib/api/notices";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;
type RunAttempt = Extract<ConsoleAttempt, { page: "run" }>;

const FORM = "com13-continue";

/**
 * SCR-COM-13 for one run: the track, the change and when it took effect, then the resolved count and the issued
 * count side by side - neither computed from the other - and every premises the run resolved, with its notice or the
 * absence of one. While the run is incomplete, Issue the outstanding notices tells the rest; a notice issued after it
 * fell due is late, and the month it fell due in is restated (SCR-COM-15).
 */
export default async function TrackChangeRunPage({ params, searchParams }: { params: Promise<{ run: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("runs"));
  const [{ run: raw }, query] = await Promise.all([params, searchParams]);
  const ref = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const kept = readForPage<ConsoleAttempt>(query);
  const attempt = kept?.page === "run" && kept.run === ref ? kept : null;
  const outcome = view === "loading" ? null : await loadTrackChangeRun(staff, ref, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <NoticeFrame
      staff={staff}
      tab="runs"
      keys={false}
      header={{
        crumbs: [{ label: t("com13.crumb"), href: routes.opsTrackChanges() }, { label: ref }],
        title: t("com13.runTitle", { ref }),
        ...(data !== null ? { status: runStateValue(data.state, t) } : {}),
      }}
      t={t}
      locale={locale}
    >
      {view === "loading" ? (
        <Panel density="console" locale={locale}>
          <Skeleton variant="facts" rows={5} density="console" locale={locale} />
        </Panel>
      ) : null}
      {failure !== null ? <NoticeFailure failure={failure} errTitle={t("com13.errTitle")} t={t} locale={locale} /> : null}
      {data !== null ? <Run data={data} attempt={attempt} t={t} locale={locale} /> : null}
      <ButtonRow>
        <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsTrackChanges()} locale={locale}>
          {t("com13.backRuns")}
        </Button>
      </ButtonRow>
    </NoticeFrame>
  );
}

function Run({ data, attempt, t, locale }: { data: TrackChangeRunView; attempt: RunAttempt | null; t: Translate; locale: Locale }) {
  const outstanding = data.resolvedCount - data.issuedCount;
  const held = data.resolvedCount === 0 && data.alreadyInEffect;
  return (
    <>
      {attempt !== null && attempt.refusal === null && data.state === "COMPLETE" ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t("com13.doneTitle", { resolved: data.resolvedCount })} locale={locale}>
            {t("com13.doneText", { n: attempt.issued })}
          </Toast>
        </div>
      ) : null}
      {attempt !== null && attempt.refusal !== null ? (
        <Banner family="attention" title={t(`com.refusal.${attempt.refusal.code}.title`)} code={attempt.refusal.code} live density="console" locale={locale}>
          {t(`com.refusal.${attempt.refusal.code}.text`, attempt.refusal.values)}
        </Banner>
      ) : null}
      {held ? (
        <Banner family="attention" title={t("com.refusal.TRACK_CHANGE_RUN_EMPTY.title")} code="TRACK_CHANGE_RUN_EMPTY" density="console" locale={locale}>
          {t("com13.heldText")}
        </Banner>
      ) : null}
      {data.resolvedCount === 0 && !data.alreadyInEffect ? (
        <ViewState view="empty" empty={{ variant: "governed", title: t("com13.emptyRunTitle"), text: t("com13.emptyRunText"), action: false }} level={2} density="console" locale={locale} />
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-xs), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <Panel compact density="console" locale={locale}>
          <FactList
            density="console"
            locale={locale}
            items={[
              { label: t("com13.fTrack"), value: t("com13.trackValue", { title: data.title, by: data.by }), note: data.trackRef },
              { label: t("com13.fChange"), value: t(`com.change.${data.changeKind}`) },
              { label: t("com13.fRecorded"), value: data.changeRecordedAt, kind: "datetime" },
              { label: t("com13.fEffective"), value: data.effectiveAt, kind: "datetime", note: t(data.alreadyInEffect ? "com13.inEffect" : "com13.notYet") },
            ]}
          />
        </Panel>
        <Panel compact density="console" locale={locale}>
          <StatStrip
            columns={3}
            items={[
              { value: data.resolvedCount, label: t("com13.sResolved"), note: t("com13.resolvedNote") },
              { value: data.issuedCount, label: t("com13.sIssued") },
              { value: outstanding, label: t("com13.sOutstanding"), ...(outstanding > 0 ? { emphasis: true, family: "danger" as const } : {}) },
            ]}
            locale={locale}
          />
        </Panel>
      </div>
      {outstanding > 0 ? (
        <Banner family="attention" title={t("com13.incompleteTitle", { issued: data.issuedCount, resolved: data.resolvedCount })} code="TRACK_CHANGE_RUN_INCOMPLETE" density="console" locale={locale}>
          {t("com13.incompleteText")}
        </Banner>
      ) : null}
      {data.recipients.length > 0 ? (
        <Panel title={t("com13.recipientsTitle")} level={2} compact gap="md" density="console" locale={locale}>
          <Table
            columns={[
              { key: "premises", label: t("com13.cPremises"), kind: "strong" },
              { key: "playlists", label: t("com13.cPlaylists") },
              { key: "schedules", label: t("com13.cSchedules") },
              { key: "notice", label: t("com13.cNotice"), kind: "stack", nowrap: true },
              { key: "st", label: t("com06.cState"), kind: "status" },
              { key: "device", label: t("com13.cDevice"), kind: "stack" },
            ]}
            rows={data.recipients.map((recipient) => ({
              _key: recipient.premises,
              ...(recipient.notice === null ? { _tone: "danger" } : {}),
              premises: recipient.premises,
              playlists: recipient.playlists.join(", "),
              schedules: recipient.schedules.length > 0 ? recipient.schedules.join(", ") : t("com13.noSchedule"),
              notice: recipient.notice !== null ? { text: recipient.notice.reference, href: routes.opsNotices({ notice: recipient.notice.reference }), mono: true } : { text: t("com13.noNotice"), muted: true },
              st: recipient.notice !== null ? noticeStateValue(recipient.notice.state, t) : { family: "danger", label: t("com13.sOutstanding") },
              device:
                recipient.device !== null
                  ? { text: t(`com.device.${recipient.device.condition}`), ...(recipient.device.asAt !== null ? { detail: moment(recipient.device.asAt, locale) } : {}) }
                  : { text: t("com13.noNotice"), muted: true },
            }))}
            density="console"
            caption={t("com13.recipientsTitle")}
            locale={locale}
          />
          <form id={FORM} action={continueRunAct} style={{ display: "contents" }}>
            <input type="hidden" name="run" value={data.ref} />
          </form>
          <ButtonRow align="end">
            <ConfirmAct
              formId={FORM}
              label={t("com13.issue")}
              disabledReason={outstanding > 0 ? null : t("com13.issueDone")}
              dialog={{ title: t("com13.dlgTitle", { n: outstanding }), description: t("com13.dlgText"), confirm: t("com13.dlgYes"), back: t("comOps.back") }}
              locale={locale}
            />
          </ButtonRow>
        </Panel>
      ) : null}
    </>
  );
}

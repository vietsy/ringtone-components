import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, ButtonRow, FactList, PageHeader, Panel, StatusLine, Table } from "@/components/r1";
import { Text } from "@/components/Text";
import { ActingForChoice } from "@/features/inspection/ActingForChoice";
import { openRecord, signOut } from "@/features/inspection/actions";
import { ConfirmButton } from "@/features/inspection/ConfirmButton";
import { FieldFailure, FieldFrame } from "@/features/inspection/FieldFrame";
import { ReferenceForm } from "@/features/inspection/ReferenceForm";
import { counted, joined, refusalOf, timestamp } from "@/features/inspection/words";
import { currentFieldDevice, loadFieldHome, type FieldHome, type RefusalCode } from "@/lib/api/inspection";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER17_VIEWS } from "@/lib/mock/inspection";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** Refusals that leave the inspector unable to act at all: the controls say why. */
const NO_ACTS: readonly RefusalCode[] = ["NO_EFFECTIVE_APPOINTMENT", "APPOINTMENT_SUSPENDED"];

/** The prefix of an inspection record's reference, which the record field shows before anything is typed. */
const RECORD_PREFIX = "IRC-";

/**
 * SCR-VER-17 Field client home. The inspector chooses the authority acted for, opens a record by its reference,
 * returns to an open inspection, sees what waits to upload, and starts every inspection from a verification.
 */
export default async function FieldHomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Signed in as an inspector, or sent to sign in.
  const inspector = await requireInspector();
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a state the canvas drew; otherwise the page is the session's own data.
  const view = reviewView(params, VER17_VIEWS);
  const outcome = view === "loading" ? null : await loadFieldHome(inspector.sessionId, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const device = data?.device ?? currentFieldDevice();

  return (
    <FieldFrame device={device} locale={locale}>
      <PageHeader title={t("ver17.title", { n: inspector.account })} size="public" locale={locale} />
      {failure !== null ? (
        <FieldFailure failure={failure} refusals={["NOT_AUTHORISED"]} t={t} locale={locale} />
      ) : (
        <Home data={data} waiting={device?.queue.waiting ?? null} failed={device?.queue.failed ?? null} defaultOpen={view === "signout-confirm"} t={t} locale={locale} />
      )}
    </FieldFrame>
  );
}

function Home({
  data,
  waiting,
  failed,
  defaultOpen,
  t,
  locale,
}: {
  /** Null while the home is being read. */
  data: FieldHome | null;
  waiting: number | null;
  failed: number | null;
  defaultOpen: boolean;
  t: Translate;
  locale: Locale;
}) {
  const refusal = data?.refusal ?? null;
  const offline = data?.device.network === "offline";
  const actsOff = refusal !== null && NO_ACTS.includes(refusal);
  const actsWhy =
    refusal === "NO_EFFECTIVE_APPOINTMENT" ? t("ver.noAppointmentWhy") : refusal === "APPOINTMENT_SUSPENDED" ? t("ver.suspendedWhy") : null;
  const readAt = data?.device.readAt ?? null;
  const cursor = data?.openInspectionsRefusal ?? null;
  const rows = data?.openInspections ?? [];
  const inspectionsTitle = rows.length > 0 ? counted(t, t("ver17.inspections"), rows.length) : t("ver17.inspections");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      {refusal !== null && (
        <Banner
          family="attention"
          {...bannerOf(t, refusal)}
          {...(refusal === "POLICY_READ_UNAVAILABLE"
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.field() } }
            : {})}
          density="portal"
          locale={locale}
        >
          {refusalOf(t, refusal).text}
        </Banner>
      )}
      {offline && readAt !== null && (
        <StatusLine family="info" text={t("ver17.offline")} detail={t("ver17.offlineAt", { t: timestamp(readAt, locale) })} locale={locale} />
      )}
      {data?.storageAtRisk === true && (
        <Banner family="attention" title={t("ver17.storageTitle")} density="portal" locale={locale}>
          {t("ver17.storageText")}
        </Banner>
      )}
      {data?.updateReady === true && (
        <Banner
          family="info"
          title={t("ver17.updateTitle")}
          action={{ label: t("ver17.reload"), icon: "refresh-cw", variant: "secondary", href: routes.field() }}
          density="portal"
          locale={locale}
        >
          {t("ver17.updateText")}
        </Banner>
      )}

      {/* The authority acted for is asked for only with two or more appointments in force (design/03). */}
      {data !== null && data.appointments.length > 1 && (
        <Panel inset="sm" density="portal" locale={locale}>
          <ActingForChoice
            legend={t("ver17.acting")}
            options={data.appointments.map((appointment) => ({
              value: appointment.id,
              label: appointment.authority,
              helper: t("ver17.area", { a: joined(t, appointment.areas) }),
            }))}
            value={data.actingFor}
            locale={locale}
          />
        </Panel>
      )}

      <Panel inset="sm" gap="md" density="portal" locale={locale}>
        <ReferenceForm
          action={openRecord}
          field={{ label: t("ver.recordRef"), name: "record_ref", defaultValue: "", placeholder: RECORD_PREFIX }}
          button={{ label: t("ver17.open"), variant: "secondary", size: "md", icon: "file-check" }}
          emptyReason={t("ver17.openWhy")}
          blockedReason={offline ? t("ver17.openOffline") : actsWhy}
          failure={{ title: t("ver.errTitle"), text: t("ver.errText") }}
          locale={locale}
        />
      </Panel>

      <Panel title={inspectionsTitle} level={2} inset="sm" density="portal" locale={locale}>
        {cursor !== null ? (
          <Banner family="attention" title={t("ver.cursorTitle")} code={cursor} density="portal" locale={locale}>
            {t("ver.cursorText")}
          </Banner>
        ) : (
          <Table
            columns={[
              { key: "ref", label: t("ver17.cRef"), kind: "id" },
              { key: "prem", label: t("ver17.cPrem") },
              { key: "auth", label: t("ver17.cAuth"), kind: "mono" },
              { key: "opened", label: t("ver17.cOpened"), kind: "datetime" },
              { key: "act", kind: "actions" },
            ]}
            rows={rows.map((row) => ({
              _key: row.reference,
              ...(row.pastRecordingInterval
                ? { _message: { severity: "warning", text: t("ver17.beyond") } }
                : row.recordableUntil !== null
                  ? { _message: { severity: "info", text: t("ver17.allowance", { t: timestamp(row.recordableUntil, locale) }) } }
                  : {}),
              ref: row.reference,
              prem: row.premises,
              auth: row.authorityCode,
              opened: row.openedAt,
              act: [
                {
                  label: t("ver17.open"),
                  ariaLabel: `${t("ver17.open")} ${row.reference}`,
                  variant: "secondary",
                  href: routes.fieldInspection(row.reference),
                },
              ],
            }))}
            loading={data === null ? 2 : false}
            layout="cards"
            density="portal"
            caption={inspectionsTitle}
            empty={{ variant: "not-started", title: t("ver17.emptyTitle"), action: false }}
            locale={locale}
          />
        )}
      </Panel>

      {waiting !== null && failed !== null && (
        <Panel inset="sm" density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("ver17.waiting"), value: waiting, kind: "count" },
              { label: t("ver17.failed"), value: failed, kind: "count" },
            ]}
            locale={locale}
          />
        </Panel>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <Text size="sm" tone="secondary">
          {t("ver17.startsFrom")}
        </Text>
        <ButtonRow>
          <Button
            variant="primary"
            size="lg"
            icon="qr-code"
            fullWidth
            href={routes.fieldScan()}
            {...(actsOff && actsWhy !== null ? { disabled: true, disabledReason: actsWhy } : {})}
            locale={locale}
          >
            {t("ver17.verify")}
          </Button>
          {/* The inspection console (SCR-VER-07, 18) is the same inspector's other client; its home is the lists. */}
          <Button variant="secondary" size="md" icon="monitor" fullWidth href={routes.inspectionLists()} locale={locale}>
            {t("ver17.console")}
          </Button>
          <ConfirmButton
            trigger={{ label: t("ver17.signOut"), variant: "quiet", size: "md", icon: "log-out" }}
            dialog={{
              title: t("ver17.dlgTitle", { n: R1_FORMAT.formatCount(waiting ?? 0, locale) ?? "" }),
              description: t("ver17.dlgText"),
              primary: { label: t("ver17.signOut"), variant: "primary" },
              secondaryLabel: t("ver.cancel"),
            }}
            confirm={(waiting ?? 0) > 0}
            defaultOpen={defaultOpen}
            action={signOut}
            locale={locale}
          />
        </ButtonRow>
      </div>
    </div>
  );
}

function bannerOf(t: Translate, code: RefusalCode): { title: string; code: string } {
  return { title: refusalOf(t, code).title, code };
}

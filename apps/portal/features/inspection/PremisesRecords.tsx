import { Banner, Button, ButtonRow, Columns, FactList, PageHeader, Panel, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { loadPremisesInspectionRecords, type PremisesInspectionRecords, type RecordDetail } from "@/lib/api/inspection";
import type { Principal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import type { Frame } from "@/lib/view/frame";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";
import { PremisesChoice } from "./Filters";
import { refusalNaming } from "./standing";
import { challengeText, date, deliveryText, findingsText, followUpText, refusalOf, timestamp, verifiedText } from "./words";

/**
 * SCR-VER-13 Inspection records of your premises, for both of its addresses: the premises' records, newest
 * first, and the one opened (the newest, or the one named). The record reads in plain words; codes are only in
 * the reference. A record version in force not under a request already can be asked to be reconsidered
 * (SCR-VER-14), and printed to keep (Download PDF).
 */
export async function PremisesRecords({
  principal,
  premises,
  record,
  frame,
  loading,
}: {
  principal: Principal;
  premises: string | null;
  record: string | null;
  frame: Frame;
  /** The design review's loading state. */
  loading: boolean;
}) {
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const outcome = loading ? null : await loadPremisesInspectionRecords(principal, premises, record, locale);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("inspections", frame, locale)}
      account={principal.account}
      context={data !== null ? { premises: data.premises.name, label: t("ver13.premisesLabel") } : { premises: principal.party, label: t("ver13.partyLabel") }}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("console.crumb") }]}
          title={data !== null ? t("ver13.title", { p: data.premises.name }) : t("ver13.titleGeneric")}
          {...(data !== null && data.records.length > 0 ? { meta: t("ver13.meta", { n: data.records.length, t: timestamp(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        {failure !== null ? (
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            {failure.code === "NOT_AUTHORISED_FOR_PREMISES" ? (
              <ViewState view="refused" refusal={{ ...refusalOf(t, "NOT_AUTHORISED_FOR_PREMISES"), family: "attention" }} density="portal" level={2} locale={locale} />
            ) : (
              <ViewState
                view="error"
                errorTitle={t("ver.errTitle")}
                errorText={t("ver.errText")}
                {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
                retryable={failure.retryable}
                density="portal"
                level={2}
                locale={locale}
              />
            )}
          </div>
        ) : (
          <Records data={data} phone={phone} gap={gap} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

function Records({ data, phone, gap, t, locale }: { data: PremisesInspectionRecords | null; phone: boolean; gap: string; t: Translate; locale: Locale }) {
  const inset = phone ? "sm" : "md";
  const opened = data?.opened ?? null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
      {/* The premises is asked for once the person acts for more than one (design/03 SCR-VER-13, Premises). */}
      {data !== null && data.options.length > 1 && (
        <div style={{ maxWidth: "var(--container-xl)" }}>
          <PremisesChoice
            label={t("ver13.premises")}
            options={data.options.map((option) => ({ value: option.id, label: option.name }))}
            value={data.premises.id}
            locale={locale}
          />
        </div>
      )}
      <Columns layout="halves" single={phone}>
        <Panel title={t("ver13.listTitle")} level={2} inset={inset} density="portal" locale={locale}>
          <Table
            columns={[
              { key: "ref", label: t("ver13.cRef"), kind: "id" },
              { key: "at", label: t("ver13.cAt"), kind: "datetime" },
              { key: "auth", label: t("ver13.cAuth"), kind: "mono" },
              { key: "outcome", label: t("ver13.cOutcome") },
              { key: "ch", label: t("ver13.cChallenge") },
              { key: "act", kind: "actions" },
            ]}
            rows={(data?.records ?? []).map((record) => ({
              _key: record.reference,
              ...(opened?.reference === record.reference ? { _selected: true } : {}),
              ref: record.reference,
              at: record.inspectedAt,
              auth: record.authorityCode,
              outcome: t(`ver.outcome.${record.outcome}`),
              ch: challengeText(t, record.challenge),
              act: [{ label: t("ver13.view"), ariaLabel: `${t("ver13.view")} ${record.reference}`, variant: "quiet", href: routes.inspectionRecord(record.reference) }],
            }))}
            loading={data === null ? 2 : false}
            layout="cards"
            density="portal"
            caption={t("ver13.listTitle")}
            empty={{ variant: "not-started", title: t("ver13.emptyTitle"), action: false }}
            locale={locale}
          />
        </Panel>
        {data !== null && (opened !== null || data.openedRefusal !== null) && (
          <Panel
            title={opened !== null ? t("ver13.recordTitle", { r: opened.reference, n: opened.version }) : t("ver13.listTitle")}
            {...(opened !== null && opened.version > 1 ? { status: { family: "info" as const, label: t("ver06.versionInForce") } } : {})}
            level={2}
            inset={inset}
            gap="lg"
            density="portal"
            locale={locale}
          >
            {opened === null ? (
              <Banner family="attention" title={refusalOf(t, "RECORD_NOT_FOUND").title} code="RECORD_NOT_FOUND" density="portal" locale={locale}>
                {refusalOf(t, "RECORD_NOT_FOUND").text}
              </Banner>
            ) : (
              <Opened record={opened} phone={phone} t={t} locale={locale} />
            )}
          </Panel>
        )}
      </Columns>
      <div>
        <Button variant="quiet" size="md" icon="arrow-left" fullWidth={phone} href={routes.applications()} locale={locale}>
          {t("ver.close")}
        </Button>
      </div>
    </div>
  );
}

function Opened({ record, phone, t, locale }: { record: RecordDetail; phone: boolean; t: Translate; locale: Locale }) {
  // A request already open on this version is said on the button, which waits until it is settled.
  const open = record.challenge !== null ? refusalNaming(t, "CHALLENGE_ALREADY_OPEN", record.challenge.case, locale).title : null;
  return (
    <>
      <FactList
        items={[
          { label: t("ver13.lAt"), value: record.inspectedAt, kind: "datetime" },
          { label: t("ver13.lAuth"), value: record.authority },
          { label: t("ver13.lInspector"), value: t("ver06.inspector", { name: record.inspector.name, card: record.inspector.card }) },
          // The answers the record rests on, each with its own limits: an offline one says what it could not check.
          {
            label: t("ver06.lVerified"),
            value: record.verified.length > 0 ? record.verified.map((cited) => verifiedText(t, cited, locale)).join(t("ver.listSeparator")) : null,
            missing: t("ver06.none"),
          },
          { label: t("ver13.lRecorded"), value: findingsText(t, record.findings, "sentences"), missing: t("ver06.none") },
          { label: t("ver13.lGuidance"), value: record.guidance, missing: t("ver06.none") },
          // The record reads as the party received it: the referral, what its representative said, a late recording's reason.
          ...(record.referral !== null
            ? [
                { label: t("ver05.route"), value: t(`ver.route.${record.referral.route}`) },
                { label: t("ver05.referralNote"), value: record.referral.note },
              ]
            : []),
          ...(record.statement !== null ? [{ label: t("ver05.statement"), value: record.statement }] : []),
          ...(record.delayReason !== null ? [{ label: t("ver05.delay"), value: record.delayReason }] : []),
          { label: t("ver13.lFollow"), value: followUpText(t, record.followUp, record.followUpBy, locale) },
          { label: t("ver13.lChallenge"), value: challengeText(t, record.challenge) },
          { label: t("ver06.delivery"), value: deliveryText(t, record.delivery, locale) },
          ...(record.correctedUnderCase !== null ? [{ label: t("ver06.lCorrection"), value: record.correctedUnderCase, kind: "id" as const }] : []),
          ...record.superseded.map((version) => ({
            label: t("ver13.lEarlier", { n: version.version }),
            value: t("ver13.superseded", { issued: date(version.issuedAt, locale), at: timestamp(version.supersededAt, locale) }),
          })),
        ]}
        density="portal"
        locale={locale}
      />
      <ButtonRow>
        <Button
          variant="primary"
          size="md"
          icon="scale"
          fullWidth={phone}
          {...(open !== null ? { disabled: true, disabledReason: open } : { href: routes.requestReconsideration({ subject: record.reference }) })}
          locale={locale}
        >
          {t("ver13.request")}
        </Button>
        <Button variant="secondary" size="md" icon="download" fullWidth={phone} href={routes.inspectionRecordPrint(record.reference)} locale={locale}>
          {t("ver13.pdf")}
        </Button>
      </ButtonRow>
    </>
  );
}

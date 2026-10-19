import {
  Banner,
  Button,
  Columns,
  Combobox,
  Comparison,
  DateField,
  FactList,
  PageHeader,
  Panel,
  Skeleton,
  StatusLine,
  Toast,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { readDate } from "@/features/parties/fields";
import { NotYourPremises } from "@/features/parties/NotYourPremises";
import { PanelForm } from "@/features/parties/PanelForm";
import { PremisesTimeline } from "@/features/parties/PremisesTimeline";
import { recordPartyAction } from "@/features/parties/premises-actions";
import { areaWords, causeWords, classWords, day, licensingLine, licensingStatus, moment, premisesRefusal, premisesStatus, premisesTranslator, valueWords, writtenWords } from "@/features/parties/premises-copy";
import { ShortcutButton } from "@/features/parties/ShortcutButton";
import { readForPage } from "@/lib/api/flash";
import { loadPremisesDetail, loadPremisesTimeline, type FieldFact, type PremisesAttempt, type PremisesDetail, type ProvenanceRoute, type SourceName } from "@/lib/api/premises";
import { currentPrincipal, holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-07 Premises detail, where the premises register converges: the register entry with where each field came
 * from, the party now and since when, the licensing status with the time it was derived and the record it came from
 * (DR-207), and what is outstanding against it: a pending change with the party the register carries it under until
 * its date (FR-PTY-037), and a reconciliation difference the data owner decides. The officer records the party
 * operating a never-operated premises beside the page, and a change on its own page. Under the entry, every
 * relationship with its period and end cause and every change recorded (GET /premises/{id}/relationships, /changes),
 * and the question who operated the premises at a moment (GET /premises/{id}/relationship-at, `?at=`), refused for a
 * moment that has not arrived (FR-PTY-045, 046). A premises actor who opens it meets their own portal's page.
 */
export default async function PremisesPage({ params, searchParams }: { params: Promise<{ premises: string }>; searchParams: Promise<SearchParams> }) {
  const { premises } = await params;
  const record = decodeURIComponent(premises);
  const query = await searchParams;
  const principal = await currentPrincipal();
  if (principal !== null) return <NotYourPremises principal={principal} record={record} query={query} screen="pty07" />;
  const staff = await requireStaff("ACT-OPS", "ACT-DAT", "ACT-AUD");
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(query, PREMISES_VIEWS);
  const outcome = asked === "loading" ? null : await loadPremisesDetail(staff, record, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // The relationship question: the moment asked, the timeline answered with it, or answered without it where refused.
  const at = typeof query.at === "string" && query.at !== "" ? query.at : null;
  const timed = data !== null && holds(staff, "ACT-OPS", "ACT-AUD") ? await loadPremisesTimeline(staff, data.record, at) : null;
  const refusedAt = at !== null && timed !== null && timed.failure !== null ? timed.failure.code : null;
  const timeline = refusedAt !== null && data !== null ? (await loadPremisesTimeline(staff, data.record, null)).data : (timed?.data ?? null);
  const attempt = readForPage<PremisesAttempt>(query);
  const kept = attempt?.form === "relationship" && attempt.subject === record ? attempt : null;
  const recording = data !== null && data.mayAct && (query.panel === "party" || (kept?.refusal ?? null) !== null);
  const operated = data?.party ?? null;
  const recordWhy =
    data === null ? null : data.pending !== null ? premisesRefusal(t, "CHANGE_ALREADY_PENDING", { on: day(data.pending.effectiveOn, locale) }).text : operated === null ? premisesRefusal(t, "NOT_OPERATED").text : null;

  return (
    <OpsFrame console="operations" current="parties" staff={staff} searchLabel={t("party.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("party.crumb"), href: routes.opsParties() },
            { label: t("prm.register"), href: routes.opsPremisesRegister() },
          ]}
          title={data !== null ? data.name : t("pty07.titleGeneric")}
          {...(data !== null ? { status: premisesStatus(data.state, t), meta: t("pty07.asOf", { ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          {data !== null ? (
            <>
              <ShortcutButton variant="secondary" size="sm" icon="history" shortcut="Alt+H" href={routes.opsPremisesHistory(data.record)} locale={locale}>
                {t("pty07.history")}
              </ShortcutButton>
              {data.mayAct ? (
                <>
                  <ShortcutButton variant="secondary" size="sm" icon="building-2" shortcut="Alt+P" href={routes.opsPremises(data.record, "party")} locale={locale}>
                    {t("pty07.recordParty")}
                  </ShortcutButton>
                  {recordWhy !== null ? (
                    <Button variant="primary" size="sm" disabled disabledReason={recordWhy} locale={locale}>
                      {t("pty07.record")}
                    </Button>
                  ) : (
                    <ShortcutButton variant="primary" size="sm" shortcut="Alt+C" href={routes.opsPremisesChange(data.record)} locale={locale}>
                      {t("pty07.record")}
                    </ShortcutButton>
                  )}
                </>
              ) : null}
            </>
          ) : null}
        </PageHeader>
        {typeof kept?.done === "string" && data !== null && data.party !== null ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast family="positive" title={t("pty07.partyDone")} locale={locale}>
              {t("pty07.partyDoneText", { party: data.party.legalName, d: data.party.since !== null ? day(data.party.since, locale) : "" })}
            </Toast>
          </div>
        ) : null}
        <Columns side="md" single={!recording}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
            {asked === "loading" ? (
              <>
                <Panel title={t("pty07.entry")} level={2} compact locale={locale}>
                  <Skeleton variant="facts" rows={6} density="console" locale={locale} />
                </Panel>
                <Panel compact locale={locale}>
                  <Skeleton variant="card" rows={3} density="console" locale={locale} />
                </Panel>
              </>
            ) : failure?.code === "PREMISES_NOT_FOUND" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
                <ViewState view="refused" refusal={{ ...premisesRefusal(t, "PREMISES_NOT_FOUND"), family: "attention" }} density="console" locale={locale} />
                <Button variant="secondary" size="sm" href={routes.opsPremisesRegister()} locale={locale}>
                  {t("pty07.back")}
                </Button>
              </div>
            ) : failure !== null || data === null ? (
              <ViewState view="error" errorTitle={t("pty07.errTitle")} errorText={t("prm.errText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
            ) : (
              <>
                <Detail data={data} t={t} locale={locale} />
                {timeline !== null ? <PremisesTimeline timeline={timeline} ask={{ action: routes.opsPremisesAt(data.record), at, refused: refusedAt }} density="console" t={t} locale={locale} /> : null}
              </>
            )}
          </div>
          {recording && data !== null ? <PartyPanel data={data} attempt={kept} t={t} locale={locale} /> : null}
        </Columns>
      </div>
    </OpsFrame>
  );
}

/** R1's provenance chip for a route, and the detail it names: the alternative source, or the override's authority. */
function chip<T>(fact: FieldFact<T>, t: Translate): { provenance?: "registry-sourced" | "alternative-route" | "manual-override" | "declared"; provenanceDetail?: string } {
  const route: ProvenanceRoute | null = fact.route;
  const source: SourceName | null = fact.source;
  if (route === "AUTHORITATIVE_SOURCE") return { provenance: "registry-sourced" };
  if (route === "ALTERNATIVE_ROUTE") return { provenance: "alternative-route", ...(source !== null ? { provenanceDetail: t(`prm.sourceShort.${source}`) } : {}) };
  if (route === "MANUAL_OVERRIDE") return { provenance: "manual-override", ...(fact.authority !== null ? { provenanceDetail: fact.authority } : {}) };
  if (route === "MANUAL_ADMISSION") return { provenance: "declared" };
  return {};
}

function Detail({ data, t, locale }: { data: PremisesDetail; t: Translate; locale: Locale }) {
  const pending = data.pending;
  const area = data.area.value;
  const facts = [
    {
      label: t("pty07.party"),
      value: data.party?.legalName ?? null,
      missing: t("prm.none"),
      ...(data.party !== null && data.party.since !== null ? { note: t("pty07.since", { d: day(data.party.since, locale) }) } : {}),
      ...(data.party?.route === "AUTHORITATIVE_SOURCE" ? { provenance: "registry-sourced" as const } : {}),
    },
    {
      label: t("pty07.lic"),
      value: licensingStatus(data.licensing.status, t),
      kind: "status" as const,
      note: licensingLine(data.licensing, { derived: "pty07.derived", derivedAdmit: "pty07.derivedAdmit", stale: "pty06.stale" }, t, locale),
    },
    { label: t("pty07.cls"), value: data.classification.value !== null ? classWords(data.classification.value, t) : null, missing: t("prm.notRecorded"), ...chip(data.classification, t) },
    {
      label: t("pty07.areaL"),
      value: area !== null ? areaWords(area, t) : null,
      missing: t("prm.notRecorded"),
      ...(area !== null ? { note: t("pty07.geo", { v: area.version }) } : {}),
      ...chip(data.area, t),
    },
    { label: t("pty07.name"), value: data.tradingName.value, missing: t("prm.notRecorded"), ...chip(data.tradingName, t) },
    { label: t("pty07.rec"), value: data.record, kind: "id" as const },
    { label: t("pty07.address"), value: data.address.value, missing: t("prm.notRecorded"), ...chip(data.address, t) },
  ];
  return (
    <>
      <Panel
        title={t("pty07.entry")}
        level={2}
        {...(data.mayReadProvenance ? { actions: [{ kind: "link" as const, label: t("pty07.where"), href: routes.opsPremisesProvenance(data.record) }] } : {})}
        compact
        locale={locale}
      >
        <FactList items={facts} columns={2} density="console" locale={locale} />
        {data.neverOperated ? (
          <StatusLine
            family="info"
            text={t("pty07.never")}
            detail={area !== null ? t("pty07.neverDetail", { area: area.ward, s: t(`prm.licensing.${data.licensing.status}`) }) : t("pty07.neverDetailNoArea", { s: t(`prm.licensing.${data.licensing.status}`) })}
            cutout="surface"
            locale={locale}
          />
        ) : null}
      </Panel>
      {pending !== null ? (
        <Panel family="attention" familyLabel={t("pty07.pendingWord")} title={t("pty07.pendingTitle", { cause: t(`prm.causeLower.${pending.cause}`), d: day(pending.effectiveOn, locale) })} level={2} compact locale={locale}>
          <FactList
            items={[
              { label: t("pty07.cause"), value: causeWords(pending.cause, t) },
              { label: t("pty07.effective"), value: pending.effectiveOn, kind: "date" as const },
              { label: t("pty07.recorded"), value: pending.recordedAt, kind: "datetime" as const, note: t("pty07.by", { p: pending.recordedBy }) },
              pending.incoming !== null
                ? { label: t("pty07.incoming"), value: pending.incoming.legalName, note: pending.incoming.record }
                : { label: t("pty07.basis"), value: pending.basis !== null ? writtenWords(pending.basis, t, locale) : null, missing: t("pty07.noBasis") },
            ]}
            columns={2}
            density="console"
            locale={locale}
          />
          <Text size="sm">{t("pty07.carries", { party: pending.outgoing.legalName, d: day(pending.effectiveOn, locale) })}</Text>
        </Panel>
      ) : null}
      {data.differences.length > 0 ? (
        <Panel title={t("pty07.diffTitle")} description={t("pty07.diffDesc", { d: day(data.differences[0]?.run.startedAt ?? "", locale) })} level={2} compact locale={locale}>
          <Comparison
            columns={[
              { key: "reg", label: t("pty07.cReg") },
              { key: "src", label: t("pty07.cSrc") },
            ]}
            rows={data.differences.map((difference) => ({
              key: difference.id,
              label: t(`prm.field.${difference.field}`),
              values: { reg: valueWords(difference.registerValue, t), src: valueWords(difference.sourceValue, t) },
              changed: true,
            }))}
            rowLabel={t("pty07.rowLabel")}
            caption={t("pty07.diffTitle")}
            density="console"
            locale={locale}
          />
        </Panel>
      ) : null}
      {pending === null && data.differences.length === 0 ? (
        <Panel title={t("pty07.outstanding")} level={2} compact locale={locale}>
          <Text size="sm" tone="secondary">
            {t("pty07.nothing")}
          </Text>
        </Panel>
      ) : null}
    </>
  );
}

/** Record party (P1): the party operating the premises from a day (POST /premises/{id}/relationships). */
function PartyPanel({ data, attempt, t, locale }: { data: PremisesDetail; attempt: PremisesAttempt | null; t: Translate; locale: Locale }) {
  const value = (name: string) => {
    const typed = attempt?.values[name];
    return typeof typed === "string" ? typed : "";
  };
  const failed = attempt?.refusal ?? null;
  const refusal = failed !== null ? premisesRefusal(t, failed.code, failed.values) : null;
  const overlap =
    failed?.code === "RELATIONSHIP_OVERLAPS"
      ? failed.values.since !== undefined && failed.values.since !== ""
        ? t("pty07.overlapNote", { party: failed.values.party ?? "", record: failed.values.record ?? "", since: day(failed.values.since, locale) })
        : t("pty07.overlapNoteUndated", { party: failed.values.party ?? "", record: failed.values.record ?? "" })
      : null;
  return (
    <PanelForm action={recordPartyAction.bind(null, data.record)} title={t("pty07.recordParty")} eyebrow={t("pty07.partyEyebrow", { r: data.record })} submit={t("pty07.recordParty")} cancel={t("prm.cancel")} closeHref={routes.opsPremises(data.record)} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Text size="sm" tone="secondary">
          {t("pty07.partyDesc")}
        </Text>
        {failed !== null && refusal !== null && failed.code === "RELATIONSHIP_OVERLAPS" ? (
          <Banner family="attention" title={refusal.title} code={failed.code} compact density="console" live locale={locale}>
            {refusal.text} {overlap}
          </Banner>
        ) : null}
        <Combobox
          label={t("pty07.fParty")}
          helper={t("pty07.fPartyHelp")}
          name="party_id"
          options={data.parties.map((party) => ({ value: party.record, label: party.legalName, detail: party.businessRegistration !== null ? `${party.record}, ${party.businessRegistration}` : party.record }))}
          value={value("party_id")}
          placeholder={t("pty07.fPartyPh")}
          wrap
          selectedDetail
          required
          {...(failed !== null && refusal !== null && failed.field === "party_id" && failed.code !== "RELATIONSHIP_OVERLAPS" ? { error: refusal.text } : {})}
          density="console"
          width="100%"
          locale={locale}
        />
        <DateField
          label={t("pty07.fFrom")}
          name="effective_from"
          value={readDate(value("effective_from")) ?? ""}
          required
          {...(failed?.field === "effective_from" && refusal !== null ? { error: `${refusal.text} ${t("prm.fieldMissing.effective_from")}` } : {})}
          density="console"
          width="var(--space-48)"
          locale={locale}
        />
      </div>
    </PanelForm>
  );
}

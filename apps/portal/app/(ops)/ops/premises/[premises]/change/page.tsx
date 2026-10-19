import { Banner, Button, FactList, ItemList, PageHeader, Panel, Skeleton, Table, Toast, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ChangeForm } from "@/features/parties/ChangeForm";
import { recordChangeAction } from "@/features/parties/premises-actions";
import { capital, count, day, dispositionStatus, entitlementTitle, factItem, premisesRefusal, premisesStatus, premisesTranslator, shortDay } from "@/features/parties/premises-copy";
import { readDate } from "@/features/parties/fields";
import { readForPage } from "@/lib/api/flash";
import { loadChangeDispositions, loadChangeForm, type ChangeDispositions, type ChangeForm as ChangeFormData, type PremisesAttempt } from "@/lib/api/premises";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * SCR-PTY-09 Record a premises change: an operator change, a closure or a cessation, with its effective date. A
 * backdated change names the published facts it contradicts and says withdrawing them is a separate act (FR-PTY-038);
 * a later one says under which party, and in CHANGE_PENDING, the register carries the premises until then
 * (FR-PTY-037). Recording raises a disposition for each record issued to the outgoing party before the date, listed
 * afterwards with the way to SCR-PTY-16, which a business approver decides (PERM-423).
 */
export default async function RecordChangePage({ params, searchParams }: { params: Promise<{ premises: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const [{ premises }, query] = await Promise.all([params, searchParams]);
  const record = decodeURIComponent(premises);
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(query, PREMISES_VIEWS);
  const effective = readDate(text(query.effective) ?? "");
  const outcome = asked === "loading" ? null : await loadChangeForm(staff, record, effective, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = readForPage<PremisesAttempt>(query);
  const kept = attempt?.form === "change" && attempt.subject === record ? attempt : null;
  const recorded = typeof kept?.done === "string" ? (await loadChangeDispositions(staff, kept.done, null)).data : null;

  return (
    <OpsFrame console="operations" current="parties" staff={staff} searchLabel={t("party.search")} keyMap={[{ keys: ["Esc"], label: t("pty09.kEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("party.crumb"), href: routes.opsParties() },
            { label: t("prm.register"), href: routes.opsPremisesRegister() },
            ...(data !== null ? [{ label: data.name, href: routes.opsPremises(data.record) }] : []),
          ]}
          title={data !== null ? t("pty09.title", { p: data.name }) : t("pty07.titleGeneric")}
          {...(data !== null ? { status: premisesStatus(data.state, t), meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        {asked === "loading" ? (
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <Panel locale={locale}>
              <Skeleton variant="card" rows={6} density="console" locale={locale} />
            </Panel>
          </div>
        ) : failure?.code === "PREMISES_NOT_FOUND" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            <ViewState view="refused" refusal={{ ...premisesRefusal(t, failure.code), family: "attention" }} density="console" locale={locale} />
            <Button variant="secondary" size="sm" href={routes.opsPremisesRegister()} locale={locale}>
              {t("pty07.back")}
            </Button>
          </div>
        ) : failure !== null || data === null ? (
          // The contradiction check is part of this read: without it a backdated change cannot be recorded.
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <ViewState view="error" errorTitle={t("pty09.cfTitle")} errorText={t("pty09.cfText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
          </div>
        ) : recorded !== null ? (
          <Recorded data={recorded} t={t} locale={locale} />
        ) : data.pending !== null || data.party === null ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            {data.pending !== null ? (
              <Banner family="attention" title={premisesRefusal(t, "CHANGE_ALREADY_PENDING").title} code="CHANGE_ALREADY_PENDING" density="console" locale={locale}>
                {premisesRefusal(t, "CHANGE_ALREADY_PENDING", { on: day(data.pending.effectiveOn, locale) }).text}
              </Banner>
            ) : (
              <Banner family="attention" title={premisesRefusal(t, "NOT_OPERATED").title} code="NOT_OPERATED" density="console" locale={locale}>
                {premisesRefusal(t, "NOT_OPERATED").text}
              </Banner>
            )}
            <Button variant="secondary" size="sm" href={routes.opsPremises(data.record)} locale={locale}>
              {t("pty09.backPremises")}
            </Button>
          </div>
        ) : (
          <ChangeForm
            data={data}
            draft={{ cause: text(query.cause), effective, incoming: text(query.incoming) }}
            attempt={kept !== null && kept.refusal !== null ? kept : null}
            action={recordChangeAction.bind(null, data.record)}
            locale={locale}
          />
        )}
      </div>
    </OpsFrame>
  );
}

function meta(data: ChangeFormData, t: Translate, locale: Locale): string {
  if (data.party === null) return data.record;
  return data.party.since !== null
    ? t("pty09.metaSince", { r: data.record, party: data.party.legalName, d: shortDay(data.party.since, locale) })
    : t("pty09.meta", { r: data.record, party: data.party.legalName });
}

/** After Record change: what was recorded, the published facts it names, and the dispositions it raised. */
function Recorded({ data, t, locale }: { data: ChangeDispositions; t: Translate; locale: Locale }) {
  const change = data.change;
  const cause = t(`prm.causeLower.${change.cause}`);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
      <Toast family="positive" title={t("pty09.toastTitle", { cause, Cause: capital(cause) })} locale={locale}>
        {t("pty09.toastText", { facts: count(change.contradicted.length, locale), disp: count(data.rows.length, locale) })}
      </Toast>
      <Panel title={t("pty09.recTitle")} level={2} compact locale={locale}>
        <FactList
          items={[
            { label: t("pty09.cause"), value: t(`prm.cause.${change.cause}`) },
            { label: t("pty09.effective"), value: change.effectiveOn, kind: "date" },
            { label: t("pty09.outgoing"), value: change.outgoing.legalName },
            ...(change.incoming !== null ? [{ label: t("pty09.incoming"), value: change.incoming.legalName }] : []),
            { label: t("pty09.recordedL"), value: change.recordedAt, kind: "datetime", note: t("pty09.recordedBy", { p: change.recordedBy }) },
            { label: t("pty09.stateL"), value: change.applied ? t("pty09.appliedNow") : t("pty09.pendingUntil", { d: day(change.effectiveOn, locale) }) },
          ]}
          columns={2}
          density="console"
          locale={locale}
        />
        {change.contradicted.length > 0 ? (
          <Panel variant="plain" title={t("pty09.namedTitle")} level={3} compact locale={locale}>
            <ItemList items={change.contradicted.map((fact) => factItem(fact, t, locale))} readOnly density="console" label={t("pty09.namedTitle")} locale={locale} />
          </Panel>
        ) : null}
      </Panel>
      <Panel
        title={t("pty09.dispTitle")}
        description={
          data.rows.length > 0
            ? t("pty09.dispDesc", { p: change.outgoing.legalName, d: day(change.effectiveOn, locale) })
            : t("pty09.dispNone", { p: change.outgoing.legalName, d: day(change.effectiveOn, locale) })
        }
        {...(data.rows.length > 0 ? { actions: [{ kind: "link" as const, label: t("pty09.open16"), href: routes.opsChangeDispositions(change.id) }] } : {})}
        level={2}
        compact
        locale={locale}
      >
        {data.rows.length > 0 ? (
          <Table
            columns={[
              { key: "rec", label: t("pty09.cRecord"), kind: "id" },
              { key: "kind", label: t("pty09.cKind") },
              { key: "issued", label: t("pty09.cIssued") },
              { key: "state", label: t("pty09.cState"), kind: "status" },
            ]}
            rows={data.rows.map((row) => ({
              _key: row.id,
              rec: row.entitlement.reference,
              kind: entitlementTitle(row.entitlement, t, locale),
              issued: row.issuedTo.legalName,
              state: dispositionStatus(row.state, t),
            }))}
            density="console"
            caption={t("pty09.dispTitle")}
            locale={locale}
          />
        ) : null}
      </Panel>
      <div>
        <Button variant="secondary" size="sm" href={routes.opsPremises(change.premises.record)} locale={locale}>
          {t("pty09.backPremises")}
        </Button>
      </div>
    </div>
  );
}

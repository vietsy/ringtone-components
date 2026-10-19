import { Banner, Button, ButtonRow, DateField, EmptyState, FactList, PageHeader, Panel, Skeleton, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { approveIntakeVersion, saveIntakeVersion } from "@/features/cases/console-actions";
import { ConfirmSubmit } from "@/features/cases/ConfirmSubmit";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, fieldRefusal, refusalWords } from "@/features/cases/copy";
import { IntakeRoutesEditor } from "@/features/cases/IntakeRoutesEditor";
import { isoDate } from "@/features/cases/dates";
import { ROUTE_KINDS, loadIntakeMatrix, type ConsoleAttempt, type IntakeMatrixPage, type MatrixVersionView } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-CAS-16 Case-intake matrix: the version being prepared, with its effective date and its routes, the group that
 * has no route working without an account named while the table is edited (BR-CAS-01), and Approve for a business
 * approver who did not prepare it; under it, the version in force. A case officer prepares and saves; nothing takes
 * effect until the approval, and then only from the effective date.
 */
export default async function IntakeMatrixPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-CAS", "ACT-BIZ-APR");
  const params = await searchParams;
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const kept = readForPage<ConsoleAttempt>(params);
  const outcome = view === "loading" ? null : await loadIntakeMatrix(staff, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const header = kept !== null && Object.keys(kept.refusal.fields).length === 0 ? refusalWords(t, kept.refusal, locale) : null;

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("casops.crumb") }]} title={t("cas16.title")} locale={locale}>
          <Button variant="quiet" size="sm" icon="arrow-left" href={routes.opsCases()} locale={locale}>
            {t("cas04.back")}
          </Button>
        </PageHeader>
        {header !== null ? (
          <Banner family="danger" title={header.title} code={header.code} live density="console" locale={locale}>
            {header.text}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ConsoleFailure failure={failure} errorTitle={t("cas16.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
        ) : data === null ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="table" rows={6} columns={3} density="console" locale={locale} />
          </Panel>
        ) : (
          <Matrix data={data} staff={staff} kept={kept} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Matrix({ data, staff, kept, t, locale }: { data: IntakeMatrixPage; staff: Staff; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const prepared = data.prepared;
  const officer = holds(staff, "ACT-CAS");
  return (
    <>
      {prepared !== null ? (
        <Prepared version={prepared} data={data} staff={staff} kept={kept?.form === "save" ? kept : null} t={t} locale={locale} />
      ) : (
        <EmptyState variant="governed" title={t("cas16.emptyTitle")} level={2} density="console" locale={locale}>
          {t("cas16.emptyText")}
        </EmptyState>
      )}
      {prepared === null && officer && data.inForce !== null ? <Editor data={data} version={null} rows={data.inForce.routes} kept={kept?.form === "save" ? kept : null} t={t} locale={locale} /> : null}
      <Panel title={t("cas16.whatTitle")} level={2} density="console" locale={locale}>
        <Text size="base" measure="2xl">
          {t("cas16.whatText")}
        </Text>
      </Panel>
      {data.inForce !== null ? <InForce version={data.inForce} t={t} locale={locale} /> : null}
    </>
  );
}

/** The version being prepared: who prepared it, nobody yet as approver, the editor for a case officer, Approve for an approver. */
function Prepared({ version, data, staff, kept, t, locale }: { version: MatrixVersionView; data: IntakeMatrixPage; staff: Staff; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const officer = holds(staff, "ACT-CAS");
  const without = version.withoutAccountFree;
  const why = !holds(staff, "ACT-BIZ-APR")
    ? t("cas16.whyRole")
    : version.preparedBy.email === staff.email
      ? t("cas16.whySame")
      : without !== null
        ? refusalWords(t, { code: "NO_ACCOUNT_FREE_ROUTE", fields: {}, detail: { group: without } }, locale).text
        : version.effectiveFrom < data.today
          ? t("cas16.whyPast")
          : null;
  const formId = `approve-${version.id}`;
  return (
    <Panel title={t("cas16.version", { n: version.versionNo })} level={2} status={{ family: "attention", label: version.state }} density="console" gap="md" locale={locale}>
      <FactList
        columns={2}
        items={[
          { label: t("cas16.effective"), value: version.effectiveFrom, kind: "date" },
          { label: t("cas16.preparedBy"), value: version.preparedBy.name },
          { label: t("cas16.approvedBy"), value: version.approvedBy?.name ?? null, missing: t("cas16.nobody") },
        ]}
        density="console"
        locale={locale}
      />
      {officer ? (
        <Editor data={data} version={version} rows={version.routes} kept={kept} t={t} locale={locale} />
      ) : (
        <RouteTable routes={version.routes} t={t} locale={locale} />
      )}
      {!officer && without !== null ? (
        <Banner family="attention" title={t("cas16.blockedTitle")} code="NO_ACCOUNT_FREE_ROUTE" density="console" locale={locale}>
          {refusalWords(t, { code: "NO_ACCOUNT_FREE_ROUTE", fields: {}, detail: { group: without } }, locale).text}
        </Banner>
      ) : null}
      <form id={formId} action={approveIntakeVersion.bind(null, version.id)}>
        <ButtonRow align="end">
          <ConfirmSubmit
            formId={formId}
            label={t("cas16.approve")}
            disabledReason={why}
            dialog={{
              title: t("cas16.approveTitle", { n: version.versionNo }),
              description: t("cas16.approveText", { d: day(version.effectiveFrom, locale) }),
              confirm: t("cas16.approveConfirm"),
              back: t("cas07.issueBack"),
            }}
            locale={locale}
          />
        </ButtonRow>
      </form>
    </Panel>
  );
}

/** The effective date and the route table a case officer edits, saved together. */
function Editor({
  data,
  version,
  rows,
  kept,
  t,
  locale,
}: {
  data: IntakeMatrixPage;
  version: MatrixVersionView | null;
  rows: MatrixVersionView["routes"];
  kept: ConsoleAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const typed = kept?.values.effective_from;
  return (
    <form action={saveIntakeVersion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <input type="hidden" name="version_id" value={version?.id ?? ""} />
      {version === null ? (
        <Text size="base" weight="medium">
          {t("cas16.newVersion")}
        </Text>
      ) : null}
      <div style={{ maxWidth: "var(--container-sm)" }}>
        <DateField
          label={t("cas16.effective")}
          name="effective_from"
          value={isoDate(typeof typed === "string" ? typed : (version?.effectiveFrom ?? ""))}
          min={data.today}
          today={data.today}
          helper={t("cas16.effectiveHelp")}
          required
          {...fieldRefusal(t, kept?.refusal ?? null, "effectiveFrom", t("cas16.effective"), locale)}
          density="console"
          locale={locale}
        />
      </div>
      {kept?.refusal.fields.routes !== undefined ? (
        <Banner family="danger" title={refusalWords(t, kept.refusal, locale).title} code={kept.refusal.code} density="console" locale={locale}>
          {kept.refusal.code === "FIELD_MISSING" ? t("cas16.routesMissing") : refusalWords(t, kept.refusal, locale).text}
        </Banner>
      ) : null}
      <IntakeRoutesEditor
        initial={rows}
        groups={data.groups.map((group) => ({ value: group, label: t(`cas.group.${group}`) }))}
        kinds={ROUTE_KINDS.map((kind) => ({ value: kind, label: t(`casops.route.${kind}`) }))}
        words={{
          legend: t("cas16.routes"),
          helper: t("cas16.routesHelp"),
          add: t("cas16.add"),
          row: t("cas16.row"),
          group: t("cas16.group"),
          kind: t("cas16.kind"),
          account: t("cas16.account"),
          yes: t("cas16.yes"),
          no: t("cas16.no"),
          choose: t("casops.choose"),
          blockedTitle: t("cas16.blockedTitle"),
          blockedText: t("cas.refusal.NO_ACCOUNT_FREE_ROUTE.text"),
          save: t("cas16.save"),
          unanswered: t("cas16.unanswered"),
        }}
        locale={locale}
      />
    </form>
  );
}

function RouteTable({ routes: rows, t, locale }: { routes: MatrixVersionView["routes"]; t: Translate; locale: Locale }) {
  return (
    <Table
      columns={[
        { key: "group", label: t("cas16.group") },
        { key: "kind", label: t("cas16.kind") },
        { key: "account", label: t("cas16.account") },
      ]}
      rows={rows.map((route) => ({
        _key: `${route.group}-${route.kind}`,
        group: t(`cas.group.${route.group}`),
        kind: t(`casops.route.${route.kind}`),
        account: route.requiresAccount ? t("cas16.yes") : t("cas16.no"),
      }))}
      density="console"
      caption={t("cas16.routes")}
      locale={locale}
    />
  );
}

/** The version that governs today, read-only, with who prepared and who approved it. */
function InForce({ version, t, locale }: { version: MatrixVersionView; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("cas16.inForce", { n: version.versionNo })} level={2} status={{ family: "positive", label: version.state }} density="console" gap="md" locale={locale}>
      <FactList
        columns={2}
        items={[
          { label: t("cas16.effective"), value: version.effectiveFrom, kind: "date" },
          { label: t("cas16.preparedBy"), value: version.preparedBy.name },
          { label: t("cas16.approvedBy"), value: version.approvedBy?.name ?? null, missing: t("cas16.nobody") },
          { label: t("cas16.approvedAt"), value: version.approvedAt, kind: "datetime", missing: t("cas16.nobody") },
        ]}
        density="console"
        locale={locale}
      />
      <RouteTable routes={version.routes} t={t} locale={locale} />
    </Panel>
  );
}

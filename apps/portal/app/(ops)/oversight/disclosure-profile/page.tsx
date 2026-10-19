import { Button, DateField, FilterBar, PageHeader, Select, StatusLine, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { askedDay, day, moment, oversightTranslator } from "@/features/oversight/console";
import { loadDisclosureProfile, RECORD_TYPES, type DisclosureProfile, type ProfileEntry, type RecordType } from "@/lib/api/oversight";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PUB20_VIEWS } from "@/lib/mock/oversight";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The record type the screen opens on: the Player entitlement, whose minimum is `BR-PUB-11`'s five fields. */
const DEFAULT_TYPE: RecordType = "PLAYER_SERVICE_ENTITLEMENT";

/**
 * SCR-PUB-20 Disclosure profile in effect, on the oversight console. The DPO and the security officer read, for a
 * record type, the fields a public answer may carry now or on a past day, the decision that admits each protected one,
 * and every entry withheld. No version of the profile is approved in this world, so the public pages apply the minimum
 * profile, and these are the fields SCR-PUB-05 and 06 show. Anyone else on staff is refused NOT_AUTHORISED.
 */
export default async function DisclosureProfilePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const locale = await getLocale();
  const t = oversightTranslator(locale);
  const view = reviewView(params, PUB20_VIEWS);
  const recordType = RECORD_TYPES.find((type) => type === params.type) ?? DEFAULT_TYPE;
  const typedAt = typeof params.at === "string" ? params.at.trim() : "";
  // A day typed that is not a day is refused like a day not yet come: the API is asked for it and says so.
  const at = typedAt === "" ? null : (askedDay(typedAt) ?? typedAt);
  const outcome = view === "loading" ? null : await loadDisclosureProfile(staff, recordType, at, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const notAuthorised = failure?.code === "NOT_AUTHORISED";
  const minimum = data?.state === "MINIMUM_PROFILE";
  // The rows' keys are listed only while the table that binds them is on the page.
  const tableShown = failure === null || !["NOT_AUTHORISED", "INSTANT_INVALID", "POLICY_READ_UNAVAILABLE"].includes(failure.code);

  return (
    <OpsFrame
      console="oversight"
      current="disclosure"
      staff={staff}
      searchLabel={t("pubov.search")}
      keyMap={tableShown ? [{ keys: ["J", "K"], label: t("pubov.kRows") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("pubov.crumb") }]}
          title={t("pub20.title")}
          {...(data !== null ? { status: minimum ? { family: "neutral" as const, label: t("pub20.minimum") } : { family: "positive" as const, label: t("pub20.applied") } } : {})}
          {...(data !== null ? { meta: profileMeta(data, t, locale) } : {})}
          locale={locale}
        >
          {/* The counts admit the security officer, not the DPO, so only they are offered them. */}
          {holds(staff, "ACT-SEC") && (
            <Button variant="secondary" size="sm" icon="chart-column" href={routes.oversightVerificationCounts()} locale={locale}>
              {t("pubov.counts")}
            </Button>
          )}
        </PageHeader>
        {notAuthorised ? (
          <ViewState view="refused" refusal={{ code: "NOT_AUTHORISED", title: t("pubov.naTitle"), text: t("pubov.naText"), family: "attention" }} level={2} density="console" locale={locale} />
        ) : (
          <Profile data={data} failure={failure} recordType={recordType} typedAt={typedAt} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function profileMeta(data: DisclosureProfile, t: Translate, locale: Locale): string {
  const read = moment(data.readAt, locale);
  if (data.version === null) return data.asAt !== null ? t("pub20.metaMinAt", { d: day(data.asAt, locale), t: read }) : t("pub20.metaMin", { t: read });
  return t("pub20.metaApplied", { v: data.version.ref, d: day(data.version.approvedOn, locale), t: read });
}

function Profile({
  data,
  failure,
  recordType,
  typedAt,
  t,
  locale,
}: {
  data: DisclosureProfile | null;
  failure: { code: string; traceId: string | null; retryable: boolean } | null;
  recordType: RecordType;
  typedAt: string;
  t: Translate;
  locale: Locale;
}) {
  const instantRefused = failure?.code === "INSTANT_INVALID";
  const policyUnread = failure?.code === "POLICY_READ_UNAVAILABLE";
  const outage = failure !== null && !instantRefused && !policyUnread ? failure : null;
  const entries = data?.entries ?? [];
  const withheld = entries.filter((entry) => entry.state === "WITHHELD").length;

  return (
    <>
      <form action={routes.oversightDisclosureProfile()}>
        <FilterBar label={t("pub20.filterLabel")} shortcut="/" {...(data !== null ? { summary: t("pub20.fields", { n: entries.length }) } : {})} locale={locale}>
          <Select
            label={t("pub20.fType")}
            name="type"
            options={RECORD_TYPES.map((type) => ({ value: type, label: t(`pubov.type.${type}`) }))}
            value={recordType}
            width="var(--container-md)"
            density="console"
            locale={locale}
          />
          <DateField
            label={t("pub20.fAt")}
            name="at"
            {...(typedAt !== "" ? { value: askedDay(typedAt) ?? typedAt } : {})}
            helper={t("pub20.atHelp")}
            {...(instantRefused ? { error: t("pubov.refusal.INSTANT_INVALID") } : {})}
            density="console"
            locale={locale}
          />
          <Button variant="secondary" size="sm" icon="refresh-cw" type="submit" locale={locale}>
            {t("pub20.reload")}
          </Button>
        </FilterBar>
      </form>
      {data !== null && data.state === "MINIMUM_PROFILE" && (
        <StatusLine family="info" text={t("pub20.minimumLine")} detail={t("pub20.minimumDetail", { n: entries.length })} locale={locale} />
      )}
      {withheld > 0 && <StatusLine family="attention" text={t("pub20.findingsLine", { n: withheld })} detail={t("pub20.findingsDetail")} locale={locale} />}
      {policyUnread ? (
        <ViewState
          view="refused"
          refusal={{
            code: "POLICY_READ_UNAVAILABLE",
            title: t("pubov.polTitle"),
            text: t("pubov.polText"),
            family: "info",
            action: { label: t("pub20.reload"), icon: "refresh-cw", href: routes.oversightDisclosureProfile({ type: recordType }) },
          }}
          level={2}
          density="console"
          locale={locale}
        />
      ) : (
        !instantRefused && (
          <Table
            columns={[
              { key: "field", label: t("pub20.cField"), kind: "stack", minWidth: "var(--space-64)" },
              { key: "by", label: t("pub20.cBy") },
              { key: "state", label: t("pub20.cState"), kind: "status" },
            ]}
            rows={entries.map((entry) => entryRow(entry, recordType, t))}
            density="console"
            caption={t(`pubov.type.${recordType}`)}
            rowFocus
            loading={data === null && outage === null ? 5 : false}
            {...(entries.length > 0 ? { sortNote: t("pub20.sortNote") } : {})}
            {...(outage !== null
              ? { error: { text: t("pubov.errText"), ...(outage.traceId !== null ? { traceId: outage.traceId } : {}), retryable: outage.retryable } }
              : {})}
            locale={locale}
          />
        )
      )}
    </>
  );
}

/** One field: its name in words with the field's key under it, what admits it, and whether it is carried. */
function entryRow(entry: ProfileEntry, recordType: RecordType, t: Translate): Record<string, unknown> {
  const by =
    entry.admittedBy.kind === "MINIMUM"
      ? t("pub20.byMinimum")
      : entry.admittedBy.kind === "VERSION"
        ? t("pub20.byVersion", { v: entry.admittedBy.version })
        : t("pub20.byDecision", { d: entry.admittedBy.decision });
  return {
    _key: entry.field,
    ...(entry.state === "WITHHELD" ? { _tone: "attention" } : {}),
    field: { text: t(`pubov.field.${recordType}.${entry.field}`), detail: entry.field },
    by,
    state:
      entry.state === "ADMITTED"
        ? { family: "positive", label: t("pub20.shown") }
        : { family: "attention", label: t("pub20.withheld"), ...(entry.finding !== null ? { detail: t(`pub20.finding.${entry.finding}`) } : {}) },
  };
}

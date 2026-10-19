import { Button, Combobox, PageHeader, Pagination, Select, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { count, credentialStatus, day, iamopsTranslator, moment, said } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { LinkFilter } from "@/features/player-ops/LinkFilter";
import { CREDENTIAL_STATES, loadDeviceRegister, type CredentialRow, type CredentialState, type DeviceRegisterView, type RegisterFilterInput } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { IAM07_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);
const LOADING_ROWS = 8;

/**
 * SCR-IAM-07 Device register: every device that holds a credential, active first, then suspended, then revoked, the
 * most recent use first in each. A revoked device stays listed, because its evidence stays attributable to it, and
 * its state is said in words in its own column, never by colour alone.
 */
export default async function DeviceRegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-SEC");
  const params = await searchParams;
  const locale = await getLocale();
  const t = iamopsTranslator(locale);
  const view = reviewView(params, IAM07_VIEWS);
  const state = one(params.state);
  const criteria: RegisterFilterInput = { premises: one(params.premises_id), state: CREDENTIAL_STATES.find((candidate) => candidate === state) ?? null };
  const outcome = view === "loading" ? null : await loadDeviceRegister(staff, criteria, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const all = data === null ? 0 : data.totals.ACTIVE + data.totals.SUSPENDED + data.totals.REVOKED;

  return (
    <OpsFrame
      console="operations"
      current="deviceRegister"
      staff={staff}
      searchLabel={t("iamops.search")}
      keyMap={[
        { keys: ["J", "K"], label: t("iam07.kRows") },
        { keys: ["Enter"], label: t("iam07.kOpen") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("iamops.area") }]}
          title={t("iam07.title")}
          {...(data !== null && all > 0
            ? {
                meta: t("iam07.meta", {
                  n: count(all, locale),
                  a: count(data.totals.ACTIVE, locale),
                  s: count(data.totals.SUSPENDED, locale),
                  r: count(data.totals.REVOKED, locale),
                  u: moment(data.asOf, locale),
                }),
              }
            : {})}
          locale={locale}
        />
        {failure !== null ? (
          <Failure failure={failure} errorText={t("iam07.errText")} prefix="iamops" t={t} locale={locale} />
        ) : data !== null && all === 0 ? (
          <ViewState view="empty" empty={{ variant: "not-started", icon: "smartphone", title: t("iam07.emptyTitle"), action: false }} density="console" level={2} locale={locale} />
        ) : (
          <Register data={data} criteria={criteria} all={all} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Register({ data, criteria, all, t, locale }: { data: DeviceRegisterView | null; criteria: RegisterFilterInput; all: number; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const premises = data?.premisesOptions.find((option) => option.id === criteria.premises) ?? null;
  const chips = [
    ...(premises !== null ? [{ label: t("iam07.chipPremises", { s: premises.name }), href: routes.opsDeviceRegister({ ...criteria, premises: null }) }] : []),
    ...(criteria.state !== null ? [{ label: t("iam07.chipState", { s: t(`iamops.state.${criteria.state}`) }), href: routes.opsDeviceRegister({ ...criteria, state: null }) }] : []),
  ];
  const groups = CREDENTIAL_STATES.flatMap((state) => {
    const members = rows.filter((row) => row.state === state);
    if (members.length === 0) return [];
    return [
      { _key: `group-${state}`, _group: t(`iamops.state.${state}`), _groupCount: members.length, ...(state !== "ACTIVE" ? { _groupNote: t(`iam07.note.${state}`) } : {}) },
      ...members.map((row) => registerRow(row, t, locale)),
    ];
  });
  return (
    <>
      <form method="get" action={routes.opsDeviceRegister()} style={{ display: "contents" }}>
        <LinkFilter
          chips={chips}
          clearHref={routes.opsDeviceRegister()}
          summary={chips.length > 0 ? t("iam07.summary", { a: count(rows.length, locale), b: count(all, locale) }) : null}
          label={t("iam07.filters")}
          locale={locale}
        >
          <Combobox
            wrap
            label={t("iam07.fPremises")}
            name="premises_id"
            options={(data?.premisesOptions ?? []).map((option) => ({ value: option.id, label: option.name }))}
            {...(criteria.premises !== null ? { value: criteria.premises } : {})}
            placeholder={t("iam07.anyPremises")}
            density="console"
            width="var(--space-72)"
            locale={locale}
          />
          <Select
            label={t("iam07.fState")}
            name="state"
            options={[{ value: "", label: t("iam07.all") }, ...CREDENTIAL_STATES.map((state) => ({ value: state, label: t(`iamops.state.${state}`) }))]}
            value={criteria.state ?? ""}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
          <Button variant="secondary" size="sm" type="submit" locale={locale}>
            {t("iam07.show")}
          </Button>
        </LinkFilter>
      </form>
      <Table
        columns={[
          { key: "device", label: t("iam07.cDevice"), kind: "stack", nowrap: true },
          { key: "premises", label: t("iam07.cPremises"), minWidth: "var(--space-64)" },
          { key: "purpose", label: t("iam07.cPurpose"), priority: "low" },
          { key: "state", label: t("iam07.cState"), kind: "status" },
          { key: "last", label: t("iam07.cLast"), kind: "stamp", unit: "GMT+7", missing: t("iam07.never") },
        ]}
        rows={groups}
        density="console"
        caption={t("iam07.title")}
        rowFocus
        {...(rows.length > 0 ? { sortNote: t("iam07.sortNote") } : {})}
        loading={data === null ? LOADING_ROWS : false}
        empty={{ variant: "filtered", title: t("iam07.filteredTitle"), text: t("iam07.filteredText", { n: count(all, locale) }), action: false }}
        locale={locale}
      />
      {rows.length > 0 && (
        <Pagination
          summary={rows.length === 1 ? t("iam07.pagerOne") : t("iam07.pager", { a: count(rows.length, locale), b: count(rows.length, locale) })}
          hasPrev={false}
          hasNext={false}
          density="console"
          label={t("iam07.pages")}
          locale={locale}
        />
      )}
    </>
  );
}

/** The detail under a held or revoked device's state: since when, and why, in the words recorded. */
function stateDetail(row: CredentialRow, t: Translate, locale: Locale): string | null {
  if (row.state === "SUSPENDED" && row.reason !== null) return t("iam07.dSuspended", { d: day(row.since, locale), why: said(row.reason, locale) });
  if (row.state === "REVOKED" && row.revocation !== null) return t("iam07.dRevoked", { d: day(row.revocation.effectiveAt, locale), why: said(row.revocation.cause, locale) });
  return null;
}

function registerRow(row: CredentialRow, t: Translate, locale: Locale): Record<string, unknown> {
  const detail = stateDetail(row, t, locale);
  const state: CredentialState = row.state;
  return {
    _key: row.id,
    _href: routes.opsDeviceCredential(row.id),
    device: row.name !== null ? { text: row.name, detail: row.device, num: true } : { text: row.device, mono: true },
    premises: row.premises.name,
    purpose: t("iamops.purpose.PLAYBACK"),
    state: { ...credentialStatus(state, t), ...(detail !== null ? { plain: true, detail } : {}) },
    last: row.lastUsedAt,
  };
}

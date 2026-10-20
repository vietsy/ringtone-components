"use client";

import { useState, type ComponentProps } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  Button,
  Combobox,
  DateField,
  PageHeader,
  Pagination,
  SegmentedControl,
  Table,
  ViewState,
} from "@/components/r1";
import {
  GovernanceShell,
  governanceSearchLabel,
} from "@/components/shells/GovernanceShell";
import { Text } from "@/components/Text";
import type {
  MandateRegisterSnapshot,
  MandateRegisterSort,
  MandateRegisterStatus,
} from "@/lib/api/mandate-register";
import { translator, type Locale } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";
import en from "@/messages/screens/mandate-register.en.json";
import vi from "@/messages/screens/mandate-register.vi.json";
import {
  isDateFieldText,
  isIsoDay,
  isRegisterSortKey,
  readRegisterQuery,
  REGISTER_SORT_OPTIONS,
  REGISTER_STATUSES,
  selectRegisterEntries,
  updateRegisterUrl,
  type RegisterQueryKey,
} from "./state";
import type { MandateRegisterClientProps, MandateRegisterRow } from "./types";
import styles from "./MandateRegister.module.css";

const STATUS_FAMILY = {
  SUBMITTED: "attention",
  SUSPENDED: "danger",
  EFFECTIVE: "positive",
  EXPIRED: "neutral",
} as const satisfies Record<MandateRegisterStatus, string>;

// Only a recognised service code selects wording; server detail is never displayed.
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INTERNAL_ERROR: "register.error.INTERNAL_ERROR",
  SERVICE_NOT_CONFIGURED: "register.error.SERVICE_NOT_CONFIGURED",
};

export function MandateRegisterClient({
  staff,
  outcome,
  locale,
  frame,
  mock = false,
}: MandateRegisterClientProps) {
  const t = translator({ vi, en }, locale);
  const router = useRouter();
  const phone = frame === "phone";
  const failure = outcome?.failure ?? null;
  const snapshot = outcome?.data ?? null;

  return (
    <GovernanceShell
      staff={staff}
      searchLabel={governanceSearchLabel(locale)}
      locale={locale}
      mock={mock}
    >
      <div className={styles.page} data-frame={frame}>
        <div className={styles.register} data-frame={frame}>
          <PageHeader
            title={t("register.title")}
            meta={t("register.description")}
            crumbs={[
              { label: t("register.crumb.governance") },
              { label: t("register.crumb.authority") },
            ]}
            locale={locale}
          >
            <Button
              href="#"
              variant="secondary"
              size={phone ? "md" : "sm"}
              fullWidth={phone}
              locale={locale}
            >
              {t("register.action.coverage")}
            </Button>
            <Button
              href="#"
              variant="primary"
              size={phone ? "md" : "sm"}
              fullWidth={phone}
              locale={locale}
            >
              {t("register.action.record")}
            </Button>
          </PageHeader>

          {outcome === null ? (
            <div
              role="status"
              aria-label={t("register.loading")}
              aria-busy="true"
            >
              <ViewState
                view="loading"
                skeleton="table"
                columns={7}
                rows={5}
                density="console"
                locale={locale}
              />
            </div>
          ) : failure !== null || snapshot === null ? (
            <ViewState
              view="error"
              errorTitle={t("register.error.title")}
              errorText={t(
                ERROR_MESSAGES[failure?.code ?? ""] ?? "register.error.UNKNOWN",
              )}
              retryable={failure?.retryable ?? true}
              {...(failure?.traceId ? { traceId: failure.traceId } : {})}
              onRetry={() => router.refresh()}
              level={2}
              density="console"
              locale={locale}
            />
          ) : (
            <RegisterBody
              key={locale}
              snapshot={snapshot}
              locale={locale}
              frame={frame}
            />
          )}
        </div>
      </div>
    </GovernanceShell>
  );
}

function RegisterBody({
  snapshot,
  locale,
  frame,
}: {
  snapshot: MandateRegisterSnapshot;
  locale: Locale;
  frame: Frame;
}) {
  const query = useSearchParams();
  const [dateInvalid, setDateInvalid] = useState(false);
  const t = translator({ vi, en }, locale);
  const { filters, sorting } = readRegisterQuery(query, snapshot);
  const phone = frame === "phone";
  const density = phone ? "portal" : "console";
  const entries = selectRegisterEntries(snapshot, filters, sorting, locale, t);
  const snapshotAvailable = filters.asOf === snapshot.asOf;
  const hasFilters =
    filters.grantee !== null ||
    filters.kind !== null ||
    filters.status !== null ||
    !snapshotAvailable;
  const day = (value: string) => R1_FORMAT.formatDate(value, locale) ?? "";
  const count = (value: number) => R1_FORMAT.formatCount(value, locale) ?? "";

  function update(changes: Partial<Record<RegisterQueryKey, string | null>>) {
    // Next's native History API integration updates useSearchParams without another API read.
    // Reading the current URL also preserves parameters changed by another control.
    window.history.replaceState(
      null,
      "",
      updateRegisterUrl(new URL(window.location.href), changes),
    );
  }

  function clearFilters() {
    setDateInvalid(false);
    update({ grantee: null, kind: null, status: null, asOf: null });
  }

  function changeSort(key: string) {
    if (!isRegisterSortKey(key)) return;
    const direction: MandateRegisterSort["direction"] =
      sorting.key === key
        ? sorting.direction === "asc"
          ? "desc"
          : "asc"
        : key === "effectiveFrom"
          ? "desc"
          : "asc";
    update({ sort: key, dir: direction });
  }

  // RIAV's pilot belongs to the same grantee; keep the organisation's first label.
  const grantees = new Map<string, string>();
  for (const entry of snapshot.entries) {
    if (!grantees.has(entry.granteeId))
      grantees.set(entry.granteeId, entry.grantee[locale]);
  }
  const granteeOptions = [...grantees].map(([value, label]) => ({
    value,
    label,
  }));
  const columns: ComponentProps<typeof Table>["columns"] = [
    {
      key: "grantee",
      label: t("register.column.grantee"),
      kind: "link",
      sortable: true,
    },
    { key: "kind", label: t("register.column.kind") },
    {
      key: "status",
      label: t("register.column.status"),
      kind: "status",
      sortable: true,
    },
    {
      key: "scopeCount",
      label: t("register.column.scope"),
      unit: t("register.column.scopeUnit"),
      kind: "count",
      align: "end",
      missing: t("register.scope.notRecorded"),
    },
    {
      key: "effectiveFrom",
      label: t("register.column.from"),
      kind: "date",
      sortable: true,
    },
    { key: "effectiveTo", label: t("register.column.to") },
    { key: "authority", label: t("register.column.authority") },
  ];
  const rows: MandateRegisterRow[] = entries.map((entry) => ({
    _key: entry.id,
    grantee: { label: entry.grantee[locale], href: "#" },
    kind: t(`register.kind.${entry.kind}`),
    status: {
      family: STATUS_FAMILY[entry.status],
      label: t(`register.status.${entry.status}`),
    },
    scopeCount: entry.scopeCount ?? {
      missing: t("register.scope.notRecorded"),
    },
    effectiveFrom: entry.effectiveFrom,
    effectiveTo:
      entry.effectiveTo === null
        ? t("register.period.openEnded")
        : day(entry.effectiveTo),
    authority: entry.authority[locale],
  }));

  return (
    <>
      <div className={styles.filters}>
        <div className={styles.fields}>
          <div className={styles.granteeField}>
            <Combobox
              label={t("register.filter.grantee")}
              options={[
                { value: "", label: t("register.filter.allGrantees") },
                ...granteeOptions,
              ]}
              value={filters.grantee ?? ""}
              placeholder={t("register.filter.allGrantees")}
              noResults={t("register.filter.noOptions")}
              onChange={(value) =>
                update({
                  grantee:
                    typeof value === "string" && value !== "" ? value : null,
                })
              }
              density={density}
              locale={locale}
            />
          </div>
          <SegmentedControl
            label={t("register.filter.kind")}
            options={[
              { value: "", label: t("register.filter.allKinds") },
              { value: "portal", label: t("register.kind.portal") },
              { value: "organisation", label: t("register.kind.organisation") },
            ]}
            value={filters.kind ?? ""}
            onChange={(value) => update({ kind: value || null })}
            density={density}
            locale={locale}
          />
          <div className={styles.statusField}>
            <Combobox
              label={t("register.filter.status")}
              options={[
                { value: "", label: t("register.filter.allStatuses") },
                ...REGISTER_STATUSES.map((status) => ({
                  value: status,
                  label: t(`register.status.${status}`),
                })),
              ]}
              value={filters.status ?? ""}
              placeholder={t("register.filter.allStatuses")}
              onChange={(value) =>
                update({
                  status:
                    typeof value === "string" && value !== "" ? value : null,
                })
              }
              density={density}
              locale={locale}
            />
          </div>
          <div className={styles.dateField}>
            <DateField
              label={t("register.filter.asOf")}
              required
              helper={false}
              value={filters.asOf}
              today={snapshot.asOf}
              onChange={(value) => {
                const valid = typeof value === "string" && isIsoDay(value);
                setDateInvalid(!valid);
                if (valid)
                  update({ asOf: value === snapshot.asOf ? null : value });
              }}
              onBlur={(event) => {
                if (
                  typeof event === "object" &&
                  event !== null &&
                  "currentTarget" in event &&
                  event.currentTarget instanceof HTMLInputElement
                ) {
                  setDateInvalid(!isDateFieldText(event.currentTarget.value));
                }
              }}
              {...(dateInvalid
                ? { error: t("register.filter.invalidDate") }
                : {})}
              density={density}
              locale={locale}
            />
          </div>
          {phone ? (
            <div className={styles.sortField}>
              <Combobox
                label={t("register.sort.label")}
                options={REGISTER_SORT_OPTIONS.map(({ key, direction }) => ({
                  value: `${key}:${direction}`,
                  label: t(`register.sort.${key}.${direction}`),
                }))}
                value={`${sorting.key}:${sorting.direction}`}
                onChange={(value) => {
                  const selected = REGISTER_SORT_OPTIONS.find(
                    ({ key, direction }) => value === `${key}:${direction}`,
                  );
                  if (selected)
                    update({ sort: selected.key, dir: selected.direction });
                }}
                wrap
                density="portal"
                locale={locale}
              />
            </div>
          ) : null}
          {hasFilters ? (
            <Button
              variant="quiet"
              size={phone ? "md" : "sm"}
              onClick={clearFilters}
              locale={locale}
            >
              {t("register.filter.clear")}
            </Button>
          ) : null}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">
          {snapshotAvailable ? (
            <Text size="sm" tone="secondary">
              {t(
                entries.length === 1
                  ? "register.summary.one"
                  : "register.summary",
                {
                  total: count(entries.length),
                  effective: count(
                    entries.filter((entry) => entry.status === "EFFECTIVE")
                      .length,
                  ),
                  date: day(filters.asOf),
                },
              )}
            </Text>
          ) : null}
        </div>
      </div>

      {!snapshotAvailable ? (
        <Banner family="info" density={density} locale={locale} live>
          {t("register.snapshot.only", { date: day(snapshot.asOf) })}
        </Banner>
      ) : rows.length === 0 ? (
        <ViewState
          view="empty"
          level={2}
          empty={{
            variant: hasFilters ? "filtered" : "not-started",
            title: t(
              hasFilters ? "register.filtered.title" : "register.empty.title",
            ),
            text: t(
              hasFilters ? "register.filtered.text" : "register.empty.text",
            ),
            action: hasFilters ? (
              <Button
                variant="secondary"
                size={phone ? "md" : "sm"}
                onClick={clearFilters}
                locale={locale}
              >
                {t("register.filter.clear")}
              </Button>
            ) : (
              false
            ),
          }}
          density={density}
          locale={locale}
        />
      ) : (
        <div className={styles.table}>
          <Table
            columns={columns}
            rows={rows}
            layout={phone ? "cards" : "table"}
            caption={t("register.table.caption")}
            density={density}
            sort={{ key: sorting.key, dir: sorting.direction }}
            onSort={changeSort}
            sortNote={t(`register.sort.${sorting.key}.${sorting.direction}`)}
            rowHeaders
            locale={locale}
          />
        </div>
      )}

      {snapshotAvailable && rows.length > 0 ? (
        <Pagination
          summary={t("register.pagination.range", {
            from: count(1),
            to: count(rows.length),
          })}
          endNote={t("register.pagination.end")}
          label={t("register.pagination.label")}
          density={density}
          locale={locale}
        />
      ) : null}
    </>
  );
}

"use client";

import { R1_FORMAT } from "@rightone/formatting";
import type { LoadOutcome } from "@rightone/ui";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  Banner,
  Button,
  Combobox,
  DateField,
  FactList,
  Identifier,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusBadge,
  TextField,
} from "@/components/r1";
import { GovernanceShell, governanceSearchLabel } from "@/components/shells/GovernanceShell";
import type { Staff } from "@/lib/api/session";
import { Text } from "@/components/Text";
import { translator, type Locale } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";
import en from "@/messages/screens/coverage.en.json";
import vi from "@/messages/screens/coverage.vi.json";
import {
  coverageSearch,
  invalidCoverageFields,
  parseCoverageDate,
} from "./query";
import type {
  CoverageField,
  CoveragePageData,
  CoverageQuery,
  CoverageView,
} from "./types";
import styles from "./CoveragePageClient.module.css";

interface CoveragePageClientProps {
  staff: Staff;
  locale: Locale;
  frame: Frame;
  view: CoverageView | null;
  outcome: LoadOutcome<CoveragePageData>;
  search: string;
}

const EMPTY_QUERY: CoverageQuery = {
  rightType: "",
  repertoireKey: "",
  territoryCode: "",
  asOf: "",
};

export function CoveragePageClient({
  staff,
  locale,
  frame,
  view,
  outcome,
  search,
}: CoveragePageClientProps) {
  const router = useRouter();
  const t = translator({ vi, en }, locale);
  const data = outcome.data;
  const initialQuery = data?.query ?? EMPTY_QUERY;
  const [query, setQuery] = useState(initialQuery);
  const [touched, setTouched] = useState<readonly CoverageField[]>(
    data?.lookup?.invalidFields ?? [],
  );
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const lookup = data?.lookup ?? null;
  const loading = pending || view === "loading";
  const invalidFields =
    data === null ? [] : invalidCoverageFields(query, data.options);
  const edited = (Object.keys(query) as CoverageField[]).some(
    (field) => query[field] !== initialQuery[field],
  );
  const showLookup = !loading && !edited;
  const result = showLookup ? (lookup?.outcome.data ?? null) : null;
  const failure =
    outcome.failure ?? (showLookup ? (lookup?.outcome.failure ?? null) : null);
  const inset = frame === "phone" ? "sm" : "md";

  useEffect(() => {
    if (view === null && lookup !== null) resultRef.current?.focus();
  }, [lookup, view]);

  function update(field: CoverageField, value: string) {
    setQuery((current) => ({ ...current, [field]: value }));
  }

  function currentQuery(): CoverageQuery {
    const date =
      formRef.current === null
        ? null
        : new FormData(formRef.current).get("as_of");
    return {
      ...query,
      asOf: typeof date === "string" ? parseCoverageDate(date) : query.asOf,
    };
  }

  function blur(field: CoverageField) {
    if (field === "asOf") setQuery(currentQuery());
    setTouched((current) =>
      current.includes(field) ? current : [...current, field],
    );
  }

  function error(field: CoverageField): { error?: string } {
    return touched.includes(field) && invalidFields.includes(field)
      ? { error: t(`coverage.validation.${field}`) }
      : {};
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (data === null || loading) return;
    const nextQuery = currentQuery();
    const invalid = invalidCoverageFields(nextQuery, data.options);
    setQuery(nextQuery);
    setTouched(Object.keys(nextQuery) as CoverageField[]);
    if (invalid.length > 0) {
      formRef.current
        ?.querySelector<HTMLElement>(
          `[data-field="${invalid[0]}"] :is(input:not([type="hidden"]), select)`,
        )
        ?.focus();
      return;
    }
    startTransition(() =>
      router.push(`?${coverageSearch(nextQuery, search)}`, { scroll: false }),
    );
  }

  function retry() {
    startTransition(() => router.refresh());
  }

  const errorKey =
    failure !== null && Object.hasOwn(en, `coverage.error.${failure.code}`)
      ? `coverage.error.${failure.code}`
      : "coverage.error.unknown";

  return (
    <GovernanceShell staff={staff} searchLabel={governanceSearchLabel(locale)} locale={locale} mock current="coverage" mockQueueCount={14}>
      <div
        className={styles.root}
        data-frame={frame}
      >
        <PageHeader
          title={t("coverage.title")}
          crumbs={[
            { label: t("coverage.crumb.governance") },
            { label: t("coverage.crumb.authority") },
          ]}
          meta={t("coverage.description")}
          locale={locale}
        />

        {data !== null && (
          <form
            ref={formRef}
            className={styles.form}
            onSubmit={submit}
            noValidate
            aria-label={t("coverage.form.title")}
            aria-busy={loading}
          >
            <Panel
              title={t("coverage.form.title")}
              inset={inset}
              density="console"
              locale={locale}
            >
              <div className={styles.formContent}>
                <div className={styles.fields}>
                  <div className={styles.field} data-field="rightType">
                    <Select
                      name="right_type"
                      label={t("coverage.field.rightType")}
                      required
                      disabled={loading}
                      density="console"
                      locale={locale}
                      options={data.options.rightTypes.map((value) => ({
                        value,
                        label: t(`coverage.option.right.${value}`),
                      }))}
                      placeholder={t("coverage.field.rightPlaceholder")}
                      value={query.rightType}
                      onChange={(value) => update("rightType", value)}
                      onBlur={() => blur("rightType")}
                      {...error("rightType")}
                    />
                  </div>
                  <div className={styles.field} data-field="repertoireKey">
                    <TextField
                      name="repertoire_key"
                      label={t("coverage.field.repertoireKey")}
                      helper={t("coverage.field.repertoireHelp")}
                      required
                      disabled={loading}
                      density="console"
                      locale={locale}
                      value={query.repertoireKey}
                      onChange={(value) => update("repertoireKey", value)}
                      onBlur={() => blur("repertoireKey")}
                      {...error("repertoireKey")}
                    />
                  </div>
                  <div
                    className={styles.field}
                    data-field="territoryCode"
                    onBlur={() => blur("territoryCode")}
                  >
                    <Combobox
                      name="territory_code"
                      label={t("coverage.field.territoryCode")}
                      required
                      disabled={loading}
                      density="console"
                      locale={locale}
                      options={data.options.territories.map((value) => ({
                        value,
                        label: t(`coverage.option.territory.${value}`),
                      }))}
                      placeholder={t("coverage.field.territoryPlaceholder")}
                      noResults={t("coverage.field.noTerritories")}
                      value={query.territoryCode}
                      onChange={(value) =>
                        update(
                          "territoryCode",
                          typeof value === "string" ? value : "",
                        )
                      }
                      {...error("territoryCode")}
                    />
                  </div>
                  <div className={styles.field} data-field="asOf">
                    <DateField
                      name="as_of"
                      label={t("coverage.field.asOf")}
                      helper={false}
                      required
                      disabled={loading}
                      density="console"
                      locale={locale}
                      placeholder={t("coverage.field.datePlaceholder")}
                      value={initialQuery.asOf}
                      onChange={(value) =>
                        update("asOf", typeof value === "string" ? value : "")
                      }
                      onBlur={() => blur("asOf")}
                      {...error("asOf")}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={loading}
                  loadingLabel={t("coverage.loading.action")}
                  fullWidth={frame === "phone"}
                  locale={locale}
                >
                  {loading
                    ? t("coverage.loading.action")
                    : t("coverage.action.lookup")}
                </Button>
              </div>
            </Panel>
          </form>
        )}

        <div
          ref={resultRef}
          className={styles.result}
          tabIndex={-1}
          role="region"
          aria-label={t("coverage.result.regionLabel")}
          aria-live="polite"
          aria-atomic="true"
          aria-busy={loading}
        >
          {loading && (
            <Panel
              title={t("coverage.loading.title")}
              inset={inset}
              density="console"
              locale={locale}
            >
              <Skeleton
                variant="facts"
                rows={2}
                density="console"
                locale={locale}
              />
            </Panel>
          )}
          {!loading && failure !== null && (
            <Banner
              title={t(
                failure.code === "COVERAGE_INPUT_INVALID"
                  ? "coverage.validation.title"
                  : "coverage.error.title",
              )}
              family="attention"
              code={failure.code}
              density="console"
              locale={locale}
            >
              <Text>{t(errorKey)}</Text>
              {failure.retryable && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={retry}
                  locale={locale}
                >
                  {t("coverage.action.retry")}
                </Button>
              )}
            </Banner>
          )}
          {result !== null && (
            <Panel
              title={t("coverage.result.title")}
              family="danger"
              familyLabel={t("coverage.result.notCovered")}
              inset={inset}
              density="console"
              locale={locale}
            >
              <div className={styles.outcome}>
                <StatusBadge
                  family="danger"
                  label={t("coverage.result.notCovered")}
                  size="lg"
                  locale={locale}
                />
                <div className={styles.code}>
                  <Identifier
                    value={result.status}
                    size="sm"
                    copy={false}
                    locale={locale}
                  />
                </div>
              </div>
              <Text size="base">
                {t("coverage.result.explanation", {
                  date: R1_FORMAT.formatDate(result.query.asOf, locale) ?? "",
                })}
              </Text>
              <div className={styles.facts}>
                <FactList
                  items={[
                    {
                      label: t("coverage.result.asOf"),
                      value: result.query.asOf,
                      kind: "date",
                    },
                  ]}
                  density="console"
                  locale={locale}
                />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </GovernanceShell>
  );
}

"use client";

import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { R1_FORMAT } from "@rightone/formatting";
import {
  ApprovalPair,
  Button,
  FactList,
  FileList,
  PageHeader,
  Panel,
  Table,
  Timeline,
  ViewState,
  type Family,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { GovernanceShell } from "../GovernanceShell";
import type { MandateState } from "@/lib/api/governance";
import { translator } from "@/lib/i18n/translate";
import en from "@/messages/screens/mandate-detail.en.json";
import vi from "@/messages/screens/mandate-detail.vi.json";
import type { MandateDetailClientProps } from "./types";
import styles from "./MandateDetail.module.css";

const STATE_FAMILY = {
  SUBMITTED: "attention",
  APPROVED: "positive",
  EFFECTIVE: "positive",
  SUSPENDED: "danger",
  EXPIRED: "neutral",
  WITHDRAWN: "danger",
} as const satisfies Record<MandateState, Family>;

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INTERNAL_ERROR: "detail.state.error.INTERNAL_ERROR",
  SERVICE_NOT_CONFIGURED: "detail.state.error.SERVICE_NOT_CONFIGURED",
};

export function MandateDetailClient({
  account,
  outcome,
  loading,
  registerHref,
  locale,
  frame,
  mock = false,
}: MandateDetailClientProps) {
  const router = useRouter();
  const t = translator({ vi, en }, locale);
  const data = outcome.data;
  const failure = outcome.failure;
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const buttonSize = phone ? "md" : "sm";

  const columns: ComponentProps<typeof Table>["columns"] = [
    { key: "rightType", label: t("detail.scope.rightType"), nowrap: !phone },
    {
      key: "repertoire",
      label: t("detail.scope.repertoire"),
    },
    {
      key: "territory",
      label: t("detail.scope.territory"),
      kind: "strong",
    },
  ];
  const rows =
    data?.scope.map((row) => ({
      _key: row.id,
      rightType: t(`detail.scope.right.${row.rightType}`),
      repertoire:
        row.repertoire === "*"
          ? t("detail.scope.repertoire.all")
          : row.repertoire,
      territory: t(`detail.scope.territory.${row.territory}`),
    })) ?? [];

  const files: ComponentProps<typeof FileList>["items"] =
    data?.evidence.map((file) => {
      const megabytes = file.sizeBytes >= 1_000_000;
      const value =
        R1_FORMAT.formatCount(
          megabytes
            ? file.sizeBytes / 1_000_000
            : Math.ceil(file.sizeBytes / 1_000),
          locale,
        ) ?? "";
      return {
        key: file.id,
        name: file.title[locale],
        type: "pdf",
        size: t(
          megabytes ? "detail.evidence.sizeMb" : "detail.evidence.sizeKb",
          { value },
        ),
        at: file.uploadedAt,
        href: file.href,
        state: "ready",
      };
    }) ?? [];
  const events: ComponentProps<typeof Timeline>["entries"] =
    data?.history.map((entry) => ({
      id: entry.id,
      at: entry.at,
      actor: t("detail.history.actor", {
        name: entry.actor.name,
        organisation: entry.actor.organisationName,
      }),
      title: t(`detail.history.${entry.event}`),
      status: {
        family: STATE_FAMILY[entry.state],
        label: t(`detail.state.${entry.state}`),
      },
    })) ?? [];

  const content = (
    <div className={styles.detail} data-frame={frame}>
      <PageHeader
        title={
          data !== null
            ? t("detail.header.title", { organisation: data.organisation.name })
            : t("detail.header.fallbackTitle")
        }
        crumbs={[
          { label: t("detail.header.governance") },
          { label: t("detail.header.register"), href: registerHref },
        ]}
        {...(data !== null
          ? {
              status: {
                family: STATE_FAMILY[data.state],
                label: t(`detail.state.${data.state}`),
              },
              meta: t("detail.header.description"),
            }
          : {})}
        locale={locale}
      />

      {failure !== null || data === null ? (
        <ViewState
          view="error"
          errorTitle={t("detail.state.errorTitle")}
          errorText={t(
            ERROR_MESSAGES[failure?.code ?? ""] ?? "detail.state.error.UNKNOWN",
          )}
          retryable={failure?.retryable ?? true}
          onRetry={() => router.refresh()}
          {...(failure?.traceId ? { traceId: failure.traceId } : {})}
          level={2}
          density={phone ? "portal" : "console"}
          locale={locale}
        />
      ) : loading ? (
        <div
          role="status"
          aria-label={t("detail.state.loading")}
          aria-busy="true"
        >
          <ViewState
            view="loading"
            skeleton="facts"
            rows={5}
            density={phone ? "portal" : "console"}
            locale={locale}
          />
        </div>
      ) : (
        <div className={styles.columns}>
          <div className={styles.mainColumn}>
            <Panel
              title={t("detail.scope.title")}
              level={2}
              inset={inset}
              locale={locale}
            >
              {rows.length === 0 ? (
                <ViewState
                  view="empty"
                  empty={{
                    variant: "not-started",
                    title: t("detail.scope.emptyTitle"),
                    text: t("detail.scope.emptyText"),
                    action: false,
                  }}
                  level={3}
                  density={phone ? "portal" : "console"}
                  locale={locale}
                />
              ) : (
                <div className={styles.scopeTable}>
                  <Table
                    columns={columns}
                    rows={rows}
                    layout={phone ? "cards" : "table"}
                    caption={t("detail.scope.caption", {
                      organisation: data.organisation.name,
                    })}
                    footer={t("detail.scope.summary", {
                      count: R1_FORMAT.formatCount(rows.length, locale) ?? "",
                    })}
                    density={phone ? "portal" : "console"}
                    rowHeaders
                    locale={locale}
                  />
                </div>
              )}
            </Panel>

            <Panel
              title={t("detail.history.title")}
              description={t("detail.history.description")}
              level={2}
              inset={inset}
              locale={locale}
            >
              {events.length > 0 ? (
                <Timeline entries={events} locale={locale} />
              ) : (
                <Text size="sm" tone="secondary">
                  {t("detail.history.empty")}
                </Text>
              )}
            </Panel>
          </div>

          <div className={styles.sideColumn}>
            <Panel
              title={t("detail.evidence.title")}
              compact
              gap="sm"
              level={2}
              inset={inset}
              locale={locale}
            >
              <FactList
                className={styles.facts}
                items={[
                  {
                    label: t("detail.evidence.authority"),
                    value: data.authority.name[locale],
                    provenance: "registry-sourced",
                  },
                  {
                    label: t("detail.evidence.authorityId"),
                    value: data.authority.id,
                    kind: "id",
                    identifierSize: "sm",
                  },
                ]}
                density={phone ? "portal" : "console"}
                locale={locale}
              />
              <div className={styles.evidenceFiles}>
                <FileList
                  items={files}
                  label={t("detail.evidence.files")}
                  emptyText={t("detail.evidence.empty")}
                  density="portal"
                  locale={locale}
                />
              </div>
            </Panel>

            <Panel
              title={t("detail.period.title")}
              compact
              gap="sm"
              level={2}
              inset={inset}
              locale={locale}
            >
              <FactList
                className={styles.facts}
                items={[
                  {
                    label: t("detail.period.from"),
                    value: data.effectiveFrom,
                    kind: "date",
                  },
                  {
                    label: t("detail.period.to"),
                    value:
                      data.effectiveTo === null
                        ? t("detail.period.openEnded")
                        : R1_FORMAT.formatDate(data.effectiveTo, locale),
                  },
                ]}
                locale={locale}
              />
              <div className={styles.coverageAction}>
                <Button
                  variant="secondary"
                  size={buttonSize}
                  disabled
                  disabledReason={t("detail.period.coverageReason")}
                  locale={locale}
                >
                  {t("detail.period.coverage")}
                </Button>
              </div>
            </Panel>

            <Panel
              title={t("detail.approval.title")}
              description={t("detail.approval.description")}
              compact
              level={2}
              inset={inset}
              locale={locale}
            >
              <ApprovalPair
                preparer={{
                  name: data.preparer.name,
                  role: t(`detail.approval.role.${data.preparer.role}`, {
                    organisation: data.preparer.organisationName,
                  }),
                  at: data.submittedAt,
                }}
                approver={
                  data.approval !== null
                    ? {
                        name: data.approval.actor.name,
                        role: t(
                          `detail.approval.role.${data.approval.actor.role}`,
                          {
                            organisation: data.approval.actor.organisationName,
                          },
                        ),
                        at: data.approval.at,
                      }
                    : null
                }
                {...(data.approval !== null
                  ? { decision: data.approval.decision }
                  : {})}
                {...(data.approval?.comment
                  ? { comment: data.approval.comment[locale] }
                  : {})}
                preparerLabel={t("detail.approval.preparer")}
                approverLabel={t("detail.approval.reviewer")}
                awaiting={t("detail.approval.awaiting")}
                locale={locale}
              />
              {/* The approved scope preserves the enabled controls; reviewer permissions and commands follow later. */}
              <div className={styles.approvalActions}>
                <Button
                  variant="primary"
                  size={buttonSize}
                  fullWidth={phone}
                  locale={locale}
                >
                  {t("detail.approval.approve")}
                </Button>
                <Button
                  variant="secondary"
                  size={buttonSize}
                  fullWidth={phone}
                  locale={locale}
                >
                  {t("detail.approval.insufficient")}
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <GovernanceShell account={account} locale={locale} mock={mock}>
      <div className={styles.page} data-frame={frame}>
        {content}
      </div>
    </GovernanceShell>
  );
}

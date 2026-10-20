"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, PageHeader, Table, ViewState } from "@/components/r1";
import {
  governanceSearchLabel,
  GovernanceShell,
} from "@/components/shells/GovernanceShell";
import { Text } from "@/components/Text";
import { translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import en from "@/messages/screens/role-assignments.en.json";
import vi from "@/messages/screens/role-assignments.vi.json";
import { changeAssignment } from "./actions";
import { RoleAssignmentsFilters } from "./RoleAssignmentsFilters";
import {
  readRoleAssignmentsQuery,
  selectRoleAssignments,
  updateRoleAssignmentsUrl,
  type RoleAssignmentsQueryKey,
} from "./state";
import type {
  AssignmentOperation,
  RoleAssignment,
  RoleAssignmentsPageClientProps,
  RoleAssignmentsRow,
  RoleAssignmentsSnapshot,
} from "./types";
import styles from "./RoleAssignmentsPageClient.module.css";

const STATUS_FAMILY = {
  ACTIVE: "positive",
  SUSPENDED: "danger",
  REVOKED: "neutral",
} as const;
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  SELF_ASSIGNMENT: "roleAssignments.refusals.SELF_ASSIGNMENT",
  ASSIGNMENT_NOT_FOUND: "roleAssignments.refusals.ASSIGNMENT_NOT_FOUND",
  INVALID_TRANSITION: "roleAssignments.refusals.INVALID_TRANSITION",
  INVALID_OPERATION: "roleAssignments.refusals.INVALID_OPERATION",
  NOT_AUTHORISED: "roleAssignments.refusals.NOT_AUTHORISED",
  SERVICE_NOT_CONFIGURED: "roleAssignments.refusals.SERVICE_NOT_CONFIGURED",
  INTERNAL_ERROR: "roleAssignments.states.errorText",
};

export function RoleAssignmentsPageClient({
  staff,
  locale,
  frame,
  mock,
  view,
  outcome,
}: RoleAssignmentsPageClientProps) {
  const t = translator({ vi, en }, locale);
  const router = useRouter();
  const failure = outcome?.failure ?? null;
  const snapshot = outcome?.data ?? null;
  const density = frame === "phone" ? "portal" : "console";

  function returnToLive() {
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    router.replace(routes.roleAssignments(url.searchParams, url.hash), {
      scroll: false,
    });
  }

  return (
    <GovernanceShell
      staff={staff}
      locale={locale}
      mock={mock}
      current="appointments"
      searchLabel={governanceSearchLabel(locale)}
    >
      <div className={styles.page} data-frame={frame}>
        <PageHeader
          title={t("roleAssignments.page.title")}
          crumbs={[
            { label: t("coverage.crumb.governance") },
            { label: t("coverage.nav.authorities") },
          ]}
          meta={t("roleAssignments.page.description")}
          locale={locale}
        />
        {outcome === null ? (
          <div
            role="status"
            aria-label={t("roleAssignments.states.loading")}
            aria-busy="true"
          >
            <ViewState
              view="loading"
              skeleton="table"
              columns={6}
              rows={5}
              density={density}
              locale={locale}
            />
          </div>
        ) : failure !== null || snapshot === null ? (
          <ViewState
            view="error"
            errorTitle={t("roleAssignments.states.errorTitle")}
            errorText={t(
              ERROR_MESSAGES[failure?.code ?? ""] ??
                "roleAssignments.states.errorText",
            )}
            retryable={failure?.retryable ?? true}
            {...(failure?.traceId ? { traceId: failure.traceId } : {})}
            onRetry={() => {
              if (view !== null) returnToLive();
              else router.refresh();
            }}
            level={2}
            density={density}
            locale={locale}
          />
        ) : (
          <RoleAssignmentsBody
            key={locale}
            snapshot={snapshot}
            locale={locale}
            frame={frame}
            review={view !== null}
            onLive={returnToLive}
          />
        )}
      </div>
    </GovernanceShell>
  );
}

function RoleAssignmentsBody({
  snapshot,
  locale,
  frame,
  review,
  onLive,
}: {
  snapshot: RoleAssignmentsSnapshot;
  locale: RoleAssignmentsPageClientProps["locale"];
  frame: RoleAssignmentsPageClientProps["frame"];
  review: boolean;
  onLive: () => void;
}) {
  const t = translator({ vi, en }, locale);
  const router = useRouter();
  const query = useSearchParams();
  const filters = readRoleAssignmentsQuery(query, snapshot);
  const data = selectRoleAssignments(snapshot, filters);
  const phone = frame === "phone";
  const density = phone ? "portal" : "console";
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterReset, setFilterReset] = useState(0);
  const [feedback, setFeedback] = useState<{
    code: string | null;
    text: string;
    review?: boolean;
    operation?: AssignmentOperation;
  } | null>(null);
  const filtered =
    filters.role !== null ||
    filters.holder !== null ||
    filters.status !== null ||
    filters.effectiveOn !== snapshot.referenceDate;

  function update(
    changes: Partial<Record<RoleAssignmentsQueryKey, string | null>>,
  ) {
    setFeedback(null);
    window.history.replaceState(
      null,
      "",
      updateRoleAssignmentsUrl(new URL(window.location.href), changes),
    );
  }

  function clearFilters() {
    setFilterReset((value) => value + 1);
    update({ role: null, holder: null, status: null, effectiveOn: null });
  }

  function act(assignment: RoleAssignment, operation: AssignmentOperation) {
    if (review || pending) return;
    setFeedback(null);
    setBusyId(assignment.id);
    startTransition(async () => {
      try {
        const result = await changeAssignment(assignment.id, operation);
        if (result.code !== null) {
          setFeedback({
            code: result.code,
            text: t(
              ERROR_MESSAGES[result.code] ?? "roleAssignments.refusals.UNKNOWN",
            ),
          });
        } else {
          setFeedback({
            code: null,
            operation,
            text: t(
              operation === "suspend"
                ? "roleAssignments.actions.suspended"
                : "roleAssignments.actions.restored",
              { name: assignment.holderName },
            ),
          });
          router.refresh();
        }
      } catch {
        setFeedback({
          code: "UNKNOWN",
          text: t("roleAssignments.refusals.UNKNOWN"),
        });
      } finally {
        setBusyId(null);
      }
    });
  }

  const date = (day: string) => R1_FORMAT.formatDate(day, locale) ?? "";
  const columns: ComponentProps<typeof Table>["columns"] = [
    {
      key: "holder",
      label: t("roleAssignments.columns.holder"),
      kind: "stack",
      width: phone ? undefined : "var(--space-52)",
      minWidth: phone ? undefined : "var(--space-52)",
    },
    {
      key: "status",
      label: t("roleAssignments.columns.status"),
      kind: "status",
      width: phone ? undefined : "var(--space-36)",
      minWidth: phone ? undefined : "var(--space-36)",
    },
    {
      key: "scope",
      label: t("roleAssignments.columns.scope"),
      kind: "muted",
      minWidth: phone ? undefined : "var(--space-56)",
    },
    {
      key: "from",
      label: t("roleAssignments.columns.from"),
      kind: "date",
      width: phone ? undefined : "var(--space-28)",
      minWidth: phone ? undefined : "var(--space-28)",
    },
    {
      key: "to",
      label: t("roleAssignments.columns.to"),
      width: phone ? undefined : "var(--space-32)",
      minWidth: phone ? undefined : "var(--space-32)",
    },
    {
      key: "actions",
      label: t("roleAssignments.columns.actions"),
      kind: "actions",
      align: "end",
      width: phone ? undefined : "var(--space-28)",
      minWidth: phone ? undefined : "var(--space-28)",
    },
  ];

  function getHolderDetail(
    assignment: RoleAssignment,
    own: boolean,
  ): string | undefined {
    if (own) return t("roleAssignments.details.own");
    if (assignment.founding) return t("roleAssignments.details.founding");
    if (assignment.statusChangedOn === null || assignment.status === "ACTIVE") {
      return undefined;
    }

    const message =
      assignment.status === "SUSPENDED"
        ? "roleAssignments.details.suspendedOn"
        : "roleAssignments.details.revokedOn";
    return t(message, { date: date(assignment.statusChangedOn) });
  }

  function handleAssignmentAction(
    assignment: RoleAssignment,
    operation: AssignmentOperation,
  ) {
    if (review) {
      setFeedback({
        code: null,
        text: t("roleAssignments.actions.reviewOnly"),
        review: true,
      });
      return;
    }
    act(assignment, operation);
  }

  function getAssignmentActions(
    assignment: RoleAssignment,
    own: boolean,
  ): NonNullable<RoleAssignmentsRow["actions"]> {
    if (own || assignment.status === "REVOKED") return [];

    const operation = assignment.status === "SUSPENDED" ? "restore" : "suspend";
    return [
      {
        label: t("roleAssignments.actions." + operation),
        ariaLabel: t("roleAssignments.actions." + operation + "Label", {
          name: assignment.holderName,
        }),
        variant: "secondary",
        disabled: pending,
        onClick: () => handleAssignmentAction(assignment, operation),
      },
    ];
  }

  function createAssignmentRow(assignment: RoleAssignment): RoleAssignmentsRow {
    const own = assignment.holderId === snapshot.ownHolderId;
    const detail = getHolderDetail(assignment, own);

    return {
      _key: assignment.id,
      _busy: busyId === assignment.id,
      holder: {
        text: assignment.holderName,
        ...(detail !== undefined ? { detail } : {}),
        muted: assignment.status === "REVOKED",
      },
      status: {
        family: STATUS_FAMILY[assignment.status],
        label: t("roleAssignments.status." + assignment.status),
      },
      scope: t("roleAssignments.scopes." + assignment.scope),
      from: assignment.effectiveFrom,
      to:
        assignment.effectiveTo === null
          ? t("roleAssignments.details.unlimited")
          : date(assignment.effectiveTo),
      actions: getAssignmentActions(assignment, own),
    };
  }

  const rows = data.groups.flatMap<RoleAssignmentsRow>((group) => {
    const header: RoleAssignmentsRow = {
      _key: "group-" + group.role,
      _group: t("roleAssignments.roles." + group.role),
      _groupCount: group.assignments.length,
    };

    if (group.assignments.length === 0) {
      const vacant: RoleAssignmentsRow = {
        _key: "vacant-" + group.role,
        holder: {
          text: t("roleAssignments.details.vacant"),
          detail: t("roleAssignments.details.vacantExplanation"),
          muted: true,
        },
      };
      return [header, vacant];
    }

    return [header, ...group.assignments.map(createAssignmentRow)];
  });

  return (
    <>
      <div className={styles.filters}>
        <RoleAssignmentsFilters
          key={filterReset}
          filters={filters}
          holders={data.holders}
          referenceDate={snapshot.referenceDate}
          locale={locale}
          t={t}
          frame={frame}
          disabled={pending}
          onChange={(key, value) => update({ [key]: value })}
        />
        <div role="status" aria-live="polite" aria-atomic="true">
          <Text size="sm" tone="secondary">
            {t("roleAssignments.page.summary", {
              count: R1_FORMAT.formatCount(data.assignmentCount, locale) ?? "",
              vacant: R1_FORMAT.formatCount(data.vacantRoleCount, locale) ?? "",
            })}
          </Text>
        </div>
        {filtered ? (
          <div>
            <Button
              variant="quiet"
              size={phone ? "md" : "sm"}
              onClick={clearFilters}
              disabled={pending}
              locale={locale}
            >
              {t("roleAssignments.filters.clear")}
            </Button>
          </div>
        ) : null}
      </div>
      {feedback !== null ? (
        <Banner
          family={
            feedback.review
              ? "info"
              : feedback.code === null && feedback.operation === "restore"
                ? "positive"
                : "danger"
          }
          live
          density={density}
          {...(feedback.code !== null ? { code: feedback.code } : {})}
          {...(feedback.review
            ? {
                actions: {
                  label: t("roleAssignments.actions.backToLive"),
                  onClick: onLive,
                  variant: "secondary",
                },
              }
            : {})}
          locale={locale}
        >
          {feedback.text}
        </Banner>
      ) : null}
      <section
        className={styles.results}
        aria-label={t("roleAssignments.a11y.results")}
        aria-busy={pending}
      >
        {rows.length === 0 ? (
          <ViewState
            view="empty"
            level={2}
            density={density}
            locale={locale}
            empty={{
              variant: filtered ? "filtered" : "not-started",
              title: t(
                filtered
                  ? "roleAssignments.states.filteredTitle"
                  : "roleAssignments.states.emptyTitle",
              ),
              text: t(
                filtered
                  ? "roleAssignments.states.filteredText"
                  : "roleAssignments.states.emptyText",
              ),
              action: filtered ? (
                <Button
                  variant="secondary"
                  size={phone ? "md" : "sm"}
                  onClick={clearFilters}
                  locale={locale}
                >
                  {t("roleAssignments.filters.clear")}
                </Button>
              ) : (
                false
              ),
            }}
          />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            density={density}
            layout={phone ? "cards" : "table"}
            rowFocus={!phone}
            caption={t("roleAssignments.a11y.table")}
            sortNote={t("roleAssignments.page.sortNote")}
            className={styles.table}
            locale={locale}
          />
        )}
      </section>
    </>
  );
}

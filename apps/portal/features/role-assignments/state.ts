import {
  ASSIGNMENT_STATUSES,
  ROLE_IDS,
  type RoleAssignmentFilters,
  type RoleAssignmentsData,
  type RoleAssignmentsSnapshot,
} from "./types";

export const ROLE_ASSIGNMENTS_QUERY_KEYS = [
  "role",
  "holder",
  "status",
  "effectiveOn",
] as const;
export type RoleAssignmentsQueryKey =
  (typeof ROLE_ASSIGNMENTS_QUERY_KEYS)[number];

export function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** DateField emits completed dates only; validate unfinished text on blur as well. */
export function isDateFieldText(value: string): boolean {
  const text = value.trim();
  const parts =
    /^(\d{1,2})\s*[/\s.-]\s*(\d{1,2})\s*[/\s.-]\s*(\d{4})$/.exec(text) ??
    /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  if (!parts?.[1] || !parts[2] || !parts[3]) return false;
  return isIsoDay(
    `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`,
  );
}

export function readRoleAssignmentsQuery(
  query: Pick<URLSearchParams, "get" | "getAll">,
  snapshot: RoleAssignmentsSnapshot,
): RoleAssignmentFilters {
  const single = (key: RoleAssignmentsQueryKey) =>
    query.getAll(key).length === 1 ? query.get(key) : null;
  const holder = single("holder");
  const day = single("effectiveOn");
  return {
    role: ROLE_IDS.find((role) => role === single("role")) ?? null,
    holder: snapshot.assignments.some((entry) => entry.holderId === holder)
      ? holder
      : null,
    status:
      ASSIGNMENT_STATUSES.find((status) => status === single("status")) ?? null,
    effectiveOn: day !== null && isIsoDay(day) ? day : snapshot.referenceDate,
  };
}

/** Started appointments retain ended history, without reconstructing past statuses. */
export function selectRoleAssignments(
  snapshot: RoleAssignmentsSnapshot,
  filters: RoleAssignmentFilters,
): RoleAssignmentsData {
  const eligible = snapshot.assignments.filter(
    (entry) => entry.effectiveFrom <= filters.effectiveOn,
  );
  const filtered = eligible.filter(
    (entry) =>
      (filters.role === null || entry.role === filters.role) &&
      (filters.holder === null || entry.holderId === filters.holder) &&
      (filters.status === null || entry.status === filters.status),
  );
  const groups =
    snapshot.assignments.length === 0
      ? []
      : ROLE_IDS.filter(
          (role) => filters.role === null || role === filters.role,
        ).flatMap((role) => {
          const entries = filtered
            .filter((entry) => entry.role === role)
            .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
          const vacant = !eligible.some((entry) => entry.role === role);
          return entries.length > 0 ||
            (vacant && filters.holder === null && filters.status === null)
            ? [{ role, assignments: entries }]
            : [];
        });
  return {
    groups,
    holders: [
      ...new Map(
        snapshot.assignments.map((entry) => [
          entry.holderId,
          { id: entry.holderId, name: entry.holderName },
        ]),
      ).values(),
    ],
    assignmentCount: filtered.length,
    vacantRoleCount: groups.filter((group) => group.assignments.length === 0)
      .length,
    ownHolderId: snapshot.ownHolderId,
    filters,
  };
}

/** Read the latest URL to preserve simultaneous edits, unrelated parameters and its fragment. */
export function updateRoleAssignmentsUrl(
  url: URL,
  changes: Partial<Record<RoleAssignmentsQueryKey, string | null>>,
): string {
  const next = new URL(url);
  for (const key of ROLE_ASSIGNMENTS_QUERY_KEYS) {
    const value = changes[key];
    if (value === undefined) continue;
    if (value === null) next.searchParams.delete(key);
    else next.searchParams.set(key, value);
  }
  return `${next.pathname}${next.search}${next.hash}`;
}

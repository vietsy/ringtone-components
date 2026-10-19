import type { LoadOutcome } from "@rightone/ui";
import type {
  AssignmentCommandAnswer,
  AssignmentOperation,
  RoleAssignmentsActor,
  RoleAssignmentsSnapshot,
  RoleAssignmentsView,
} from "@/features/role-assignments/types";
import {
  changeRoleAssignment,
  roleAssignmentsActor,
  roleAssignmentsSnapshot,
} from "@/lib/mock/backend/role-assignments";
import {
  ROLE_ASSIGNMENTS_REVIEW_DATE,
  ROLE_ASSIGNMENTS_SEED,
} from "@/lib/mock/role-assignments";
import { currentSession } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

export type * from "@/features/role-assignments/types";
export {
  ASSIGNMENT_STATUSES,
  ROLE_IDS,
  ROLE_ASSIGNMENTS_VIEWS,
} from "@/features/role-assignments/types";

export async function currentRoleAssignmentsActor(): Promise<RoleAssignmentsActor | null> {
  if (!usesMockData()) return null;
  const session = await currentSession();
  return session === null ? null : roleAssignmentsActor(session.id);
}

const denied = <T>(): LoadOutcome<T> => ({
  data: null,
  failure: { code: "NOT_AUTHORISED", traceId: null, retryable: false },
});

/** Permission precedes every review override or read of this browser's world. */
export async function loadRoleAssignmentsSnapshot(
  view: Exclude<RoleAssignmentsView, "loading"> | null = null,
): Promise<LoadOutcome<RoleAssignmentsSnapshot>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  const actor = await currentRoleAssignmentsActor();
  if (actor === null) return denied();
  if (view === "error")
    return {
      data: null,
      failure: {
        code: "INTERNAL_ERROR",
        traceId: "role-assignments-review",
        retryable: true,
      },
    };
  return {
    data:
      view !== null
        ? {
            referenceDate: ROLE_ASSIGNMENTS_REVIEW_DATE,
            assignments:
              view === "empty"
                ? []
                : ROLE_ASSIGNMENTS_SEED.map((entry) => ({ ...entry })),
            ownHolderId: actor.holderId,
          }
        : roleAssignmentsSnapshot(actor),
    failure: null,
  };
}

/** No caller identity is accepted. Preview rendering never invokes this write seam. */
export async function updateRoleAssignment(
  id: string,
  operation: AssignmentOperation,
): Promise<LoadOutcome<AssignmentCommandAnswer>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  const actor = await currentRoleAssignmentsActor();
  if (actor === null) return denied();
  return { data: changeRoleAssignment(actor, id, operation), failure: null };
}

import type {
  AssignmentCommandAnswer,
  AssignmentOperation,
  RoleAssignment,
  RoleAssignmentsActor,
  RoleAssignmentsSnapshot,
} from "@/features/role-assignments/types";
import {
  ROLE_ASSIGNMENTS_REVIEW_DATE,
  ROLE_ASSIGNMENTS_SEED,
  ROLE_ASSIGNMENT_HOLDER_IDS,
} from "@/lib/mock/role-assignments";
import { findAccount } from "./accounts";
import { today } from "./clock";
import { sessions, table } from "./store";

/** Resolve permission and holder from retained identity; display names cannot establish ownership. */
export function roleAssignmentsActor(
  sessionId: string,
): RoleAssignmentsActor | null {
  const session = sessions().get(sessionId);
  if (
    session?.role !== "staff" ||
    typeof session.world !== "string" ||
    session.world.length === 0
  )
    return null;
  const account = findAccount(session.email);
  if (
    account?.state !== "active" ||
    account.role !== "staff" ||
    !account.staffRoles.includes("ACT-SEC")
  )
    return null;
  const holderId = Object.hasOwn(ROLE_ASSIGNMENT_HOLDER_IDS, account.email)
    ? ROLE_ASSIGNMENT_HOLDER_IDS[account.email]
    : undefined;
  if (holderId === undefined) return null;
  return { sessionId, world: session.world, account: account.name, holderId };
}

function bookOf(sessionId: string): RoleAssignment[] {
  return table(sessionId, "role-assignments", () =>
    ROLE_ASSIGNMENTS_SEED.map((entry) => ({ ...entry })),
  );
}

/** The store resolves session -> browser world; returned records cannot mutate retained state. */
export function roleAssignmentsSnapshot(
  actor: RoleAssignmentsActor,
): RoleAssignmentsSnapshot {
  return {
    referenceDate: ROLE_ASSIGNMENTS_REVIEW_DATE,
    assignments: bookOf(actor.sessionId).map((entry) => ({ ...entry })),
    ownHolderId: actor.holderId,
  };
}

/** The API rechecks permission before each command. The browser's world retains its changes. */
export function changeRoleAssignment(
  actor: RoleAssignmentsActor,
  id: string,
  operation: AssignmentOperation,
): AssignmentCommandAnswer {
  const refused = (
    code:
      | "SELF_ASSIGNMENT"
      | "ASSIGNMENT_NOT_FOUND"
      | "INVALID_TRANSITION"
      | "INVALID_OPERATION",
  ): AssignmentCommandAnswer => ({ accepted: null, refusal: { code } });
  const entry = bookOf(actor.sessionId).find((row) => row.id === id);
  if (entry === undefined) return refused("ASSIGNMENT_NOT_FOUND");
  if (entry.holderId === actor.holderId) return refused("SELF_ASSIGNMENT");
  if (operation !== "suspend" && operation !== "restore")
    return refused("INVALID_OPERATION");
  const expected = operation === "suspend" ? "ACTIVE" : "SUSPENDED";
  const day = today();
  if (
    entry.status !== expected ||
    entry.effectiveFrom > day ||
    (entry.effectiveTo !== null && entry.effectiveTo <= day)
  )
    return refused("INVALID_TRANSITION");
  entry.status = operation === "suspend" ? "SUSPENDED" : "ACTIVE";
  entry.statusChangedOn = day;
  return { accepted: { ...entry }, refusal: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { updateRoleAssignment } from "@/lib/api/role-assignments";
import { routes } from "@/lib/routes";
import type { AssignmentActionResult, AssignmentOperation } from "./types";

/** The seam resolves the actor again and validates permission and transition for every write. */
export async function changeAssignment(id: string, operation: AssignmentOperation): Promise<AssignmentActionResult> {
  const outcome = await updateRoleAssignment(id, operation);
  if (outcome.failure !== null) return { code: outcome.failure.code };
  if (outcome.data === null) return { code: "UNKNOWN" };
  if (outcome.data.refusal !== null) return { code: outcome.data.refusal.code };
  revalidatePath(routes.roleAssignments());
  return { code: null };
}

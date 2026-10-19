import type { LoadOutcome } from "@rightone/ui";
import type {
  StatusValue,
  TableActionItem,
  TableStackCell,
} from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";

/** Feature-owned data contracts; kept independent of UI implementations, API helpers and fixtures. */
export const ROLE_IDS = [
  "programme-owner",
  "legal-policy-owner",
  "policy-author",
  "policy-approver",
  "security-owner",
  "finance-approver",
  "operations-officer",
  "evidence-officer",
  "tariff-owner",
] as const;
export type RoleId = (typeof ROLE_IDS)[number];
export const ASSIGNMENT_STATUSES = ["ACTIVE", "SUSPENDED", "REVOKED"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export const ROLE_ASSIGNMENTS_VIEWS = [
  "populated",
  "loading",
  "empty",
  "error",
] as const;
export type RoleAssignmentsView = (typeof ROLE_ASSIGNMENTS_VIEWS)[number];

export interface RoleAssignment {
  id: string;
  role: RoleId;
  holderId: string;
  holderName: string;
  scope:
    | "programme"
    | "legal"
    | "definitions"
    | "policy-author"
    | "policy-approver"
    | "security"
    | "finance"
    | "operations-standards"
    | "operations-measures"
    | "evidence";
  status: AssignmentStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  statusChangedOn: string | null;
  founding: boolean;
}

export interface RoleAssignmentFilters {
  role: RoleId | null;
  holder: string | null;
  status: AssignmentStatus | null;
  effectiveOn: string;
}

export interface RoleGroup {
  role: RoleId;
  assignments: readonly RoleAssignment[];
}

export interface RoleAssignmentsData {
  groups: readonly RoleGroup[];
  holders: readonly { id: string; name: string }[];
  assignmentCount: number;
  vacantRoleCount: number;
  ownHolderId: string;
  filters: RoleAssignmentFilters;
}

/** Authorised source rows; filtering and grouping can run without another API read. */
export interface RoleAssignmentsSnapshot {
  /** Design reference day for the date filter, not a historical status reconstruction. */
  referenceDate: string;
  assignments: readonly RoleAssignment[];
  ownHolderId: string;
}

export interface RoleAssignmentsActor {
  sessionId: string;
  world: string;
  account: string;
  holderId: string;
}

export type AssignmentOperation = "suspend" | "restore";
export interface AssignmentActionResult {
  code: string | null;
}
export type AssignmentRefusalCode =
  | "SELF_ASSIGNMENT"
  | "ASSIGNMENT_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INVALID_OPERATION";
export type AssignmentCommandAnswer =
  | { accepted: RoleAssignment; refusal: null }
  | { accepted: null; refusal: { code: AssignmentRefusalCode } };

export type RoleAssignmentsSearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;

export interface RoleAssignmentsPageProps {
  searchParams: Promise<RoleAssignmentsSearchParams>;
}

export interface RoleAssignmentsPageClientProps {
  account: string;
  locale: Locale;
  frame: Frame;
  mock: boolean;
  view: RoleAssignmentsView | null;
  outcome: LoadOutcome<RoleAssignmentsSnapshot> | null;
}

export interface RoleAssignmentsRow extends Record<string, unknown> {
  _key: string;
  _group?: string;
  _groupCount?: number;
  _busy?: boolean;
  holder?: TableStackCell;
  status?: StatusValue;
  scope?: string;
  from?: string;
  to?: string;
  actions?: TableActionItem[];
}

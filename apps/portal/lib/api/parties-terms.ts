/*
 * The party register's vocabularies a client component needs (SCR-PTY-03, 11 to 13), apart from the seam so a form
 * running in the browser reads them without pulling the seam's mock backend into the client bundle. The seam
 * (`parties.ts`) re-exports every name.
 */

/** What an authority lets its holder do; the principal recorded on the console also grants, amends and revokes. */
export const ACTS = ["READ", "SUBMIT", "APPROVE", "MANAGE_AUTHORITIES"] as const;
export type Act = (typeof ACTS)[number];

/** CFG-246: the evidence a manual identification may rest on. */
export const EVIDENCE_KINDS = ["HOUSEHOLD_REGISTRATION", "ENTERPRISE_REGISTRATION"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** The identifier kinds a search of the source may send; the national source accepts the first only. */
export const IDENTIFIER_KINDS = ["BUSINESS_REGISTRATION_NUMBER", "TAX_CODE"] as const;
export type IdentifierKind = (typeof IDENTIFIER_KINDS)[number];

/**
 * The approval levels an authority with no end date may carry, lowest first. CFG-240 fixes which one it needs; while it
 * has no value every such authority is refused (DR-202 row 6), whatever approval it carries.
 */
export const APPROVAL_LEVELS = ["BRANCH_MANAGER", "PRINCIPAL", "BUSINESS_APPROVER"] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

/** The records a duplicate candidacy may name (POST /duplicate-candidates); the review decides parties (SCR-PTY-05). */
export const CANDIDACY_KINDS = ["PARTY"] as const;
export type CandidacyKind = (typeof CANDIDACY_KINDS)[number];

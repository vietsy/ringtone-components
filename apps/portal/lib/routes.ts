/**
 * Every route a screen links to, in one place, so a link from one family to another is written once
 * and a moved route breaks the type check rather than a journey.
 *
 * Paths are English and stable; the screen codes (SCR-*) are the design's names for them and appear
 * only in comments, never in a URL or on screen.
 */
import { enc, route } from "./route-groups/route";
import { registrationOpsRoutes } from "./route-groups/registration-ops";
import { statusOpsRoutes } from "./route-groups/status-ops";
import { financeOpsRoutes } from "./route-groups/finance-ops";
import { venuePortalRoutes } from "./route-groups/venue-portal";
import { publicPagesRoutes } from "./route-groups/public-pages";
import { inspectionMoreRoutes } from "./route-groups/inspection-more";
import { premisesMoreRoutes } from "./route-groups/premises-more";
import { partiesRoutes } from "./route-groups/parties";
import { premisesRegisterRoutes } from "./route-groups/premises-register";
import { playerOpsRoutes } from "./route-groups/player-ops";
import { venueOpsRoutes } from "./route-groups/venue-ops";
import { policyRoutes } from "./route-groups/policy";
import { oversightRoutes } from "./route-groups/oversight";
import { casesRoutes } from "./route-groups/cases";
import { noticesRoutes } from "./route-groups/notices";
import { engagementRoutes } from "./route-groups/engagement";
import { artistRoutes } from "./route-groups/artist";

export const routes = {
  // (public) - no credential
  /** SCR-PUB-01 What RightOne is */
  home: () => route("/"),
  /** SCR-PUB-02 Scope self-assessment */
  scope: () => route("/scope"),
  /** SCR-PUB-03 Indicative amount */
  indicativeAmount: (
    facts?: Readonly<
      Record<
        | "assessment_date"
        | "premises_class"
        | "admin_area_key"
        | "floor_area_m2"
        | "seating_capacity",
        string
      >
    >,
  ) =>
    route(
      facts === undefined
        ? "/indicative-amount"
        : `/indicative-amount?${new URLSearchParams(facts).toString()}`,
    ),
  /** SCR-PUB-04 Verify a record */
  verify: () => route("/verify"),
  /** SCR-PUB-05 Verification result */
  verification: (reference: string) => route(`/verify/${enc(reference)}`),

  // (id) - stand-ins for the RightOne ID pages (id.rightone.vn) until the portal signs in through it
  /** SCR-RID-01 Sign in */
  signIn: (attempt?: string) =>
    route(
      attempt === undefined
        ? "/id/sign-in"
        : `/id/sign-in?attempt=${enc(attempt)}`,
    ),
  /** SCR-RID-07 Register */
  register: (attempt?: string) =>
    route(
      attempt === undefined
        ? "/id/register"
        : `/id/register?attempt=${enc(attempt)}`,
    ),
  /** SCR-RID-08 Confirm the email */
  confirmEmail: (token?: string) =>
    route(
      token === undefined
        ? "/id/confirm-email"
        : `/id/confirm-email?token=${enc(token)}`,
    ),
  /** SCR-RID-04 Choose an organisation */
  chooseOrganisation: (submitted?: string) =>
    route(
      submitted === undefined
        ? "/id/choose-organisation"
        : `/id/choose-organisation?submitted=${enc(submitted)}`,
    ),
  /** Signing out: the session ends and the reader is back at sign-in (a route handler, no screen) */
  signOut: () => route("/id/sign-out"),

  // (premises) - the premises portal
  /** SCR-REG-01 My applications and decisions */
  applications: () => route("/registration"),
  /** SCR-REG-02 Start an application */
  startApplication: () => route("/registration/new"),
  /** SCR-REG-03 Tell us about the premises */
  applicationFacts: (application: string) =>
    route(`/registration/${enc(application)}/premises`),
  /** SCR-REG-04 Evidence and claims */
  applicationEvidence: (application: string) =>
    route(`/registration/${enc(application)}/evidence`),
  /** SCR-REG-05 Review and explanation */
  applicationReview: (application: string) =>
    route(`/registration/${enc(application)}/review`),
  /** SCR-REG-06 Attest and submit */
  applicationSubmit: (application: string) =>
    route(`/registration/${enc(application)}/submit`),
  /** SCR-REG-07 Application status */
  application: (application: string) =>
    route(`/registration/${enc(application)}`),
  /** SCR-REG-08 Obligation decision */
  decision: (decision: string) => route(`/decisions/${enc(decision)}`),
  /** SCR-FIN-03 Invoices and corrective documents */
  payments: () => route("/payments"),
  /** SCR-FIN-03 One invoice or corrective document, by its number ("1C26TRO 00000418"), or a payment's invoice not issued yet (PAY-) */
  invoice: (reference: string) =>
    route(`/payments/invoices/${enc(reference.trim().replace(/\s+/g, "-"))}`),
  /** SCR-FIN-01 Pay an obligation */
  pay: (decision: string) => route(`/payments/${enc(decision)}/pay`),
  /** SCR-FIN-02 Payment position */
  paymentPosition: (decision: string) => route(`/payments/${enc(decision)}`),
  /** SCR-CER-11 Status records of a premises: the premises the address names (REG's id or its register record), else a choice of them */
  statusRecords: (premises?: string, pages?: number) =>
    route(
      premises === undefined || premises === ""
        ? "/status-records"
        : `/status-records?premises=${enc(premises)}${pages !== undefined && pages > 1 ? `&pages=${String(pages)}` : ""}`,
    ),
  /** SCR-CER-12 Status record */
  statusRecord: (record: string) => route(`/status-records/${enc(record)}`),
  /** SCR-CER-13 Status record printout */
  statusRecordPrint: (record: string, printout?: string) =>
    route(
      `/status-records/${enc(record)}/print${printout === undefined ? "" : `?printout=${enc(printout)}`}`,
    ),
  /** The Player section, reserved until its screens open */
  player: () => route("/player"),

  // (inspector) - the field client on the inspector's phone
  /** SCR-VER-17 Field client home */
  field: () => route("/field"),
  /** SCR-VER-01 Scan and verify */
  fieldScan: () => route("/field/scan"),
  /** SCR-VER-02 Verification answer */
  fieldAnswer: (answer: string) => route(`/field/answers/${enc(answer)}`),
  /** SCR-VER-03 Start an inspection */
  fieldStartInspection: () => route("/field/inspections/new"),
  /** SCR-VER-04 Inspection in progress */
  fieldInspection: (inspection: string) =>
    route(`/field/inspections/${enc(inspection)}`),
  /** SCR-VER-05 Conclude the inspection */
  fieldConclude: (inspection: string) =>
    route(`/field/inspections/${enc(inspection)}/conclude`),
  /** SCR-VER-06 Inspection record */
  fieldRecord: (record: string) => route(`/field/records/${enc(record)}`),

  // (org) - the organisation portal of a rights organisation (CMO), its administrator signed in
  /** The portal's landing: the organisation's mandate, the first item of its nav (GOV 01, Q-CMO-04) */
  org: () => route("/org"),
  /** SCR-GOV-14 Our mandate */
  orgMandate: () => route("/org/mandate"),
  /** SCR-GOV-15 Participation terms */
  orgTerms: () => route("/org/terms"),
  /** SCR-CAT-02 My participation and represented scope */
  orgParticipation: () => route("/org/participation"),
  /** SCR-CAT-01 Participation application */
  orgApply: () => route("/org/participation/apply"),
  /** SCR-CAT-03 Scope amendment */
  orgAmendScope: () => route("/org/participation/amend"),
  /** SCR-CAT-04 Submit records */
  orgSubmit: () => route("/org/submissions/new"),
  /** The nav's Submissions: opens SCR-CAT-05 for the organisation's submissions (no list is specified, G-11) */
  orgSubmissions: () => route("/org/submissions"),
  /** SCR-CAT-05 Submission outcomes */
  orgSubmission: (submission: string) =>
    route(`/org/submissions/${enc(submission)}`),
  /** SCR-CAT-24 Cancel a submission */
  orgCancelSubmission: (submission: string) =>
    route(`/org/submissions/${enc(submission)}/cancel`),
  /** The nav's Claims: opens SCR-CAT-07 for the organisation's claims (no list is specified, G-11) */
  orgClaims: () => route("/org/claims"),
  /** SCR-CAT-07 Claim detail and shares */
  orgClaim: (claim: string) => route(`/org/claims/${enc(claim)}`),
  /** SCR-CAT-25 Objection and data-subject request, against the catalogue decision it names */
  orgObjection: (decision?: string) =>
    route(
      decision === undefined
        ? "/org/objections/new"
        : `/org/objections/new?decision=${enc(decision)}`,
    ),
  /** SCR-PTY-17 Verify an authorisation scope */
  orgVerify: () => route("/org/verify"),
  /** SCR-PTY-18 Verification overlap report: reserved, a CMO is refused */
  orgOverlapReport: () => route("/org/verify/overlaps"),

  // (inspector) - the inspection console on the authority's desk
  /** SCR-VER-07 Inspection lists */
  inspectionLists: () => route("/inspection/lists"),
  /** SCR-VER-08 List supply and entries */
  inspectionList: (list: string) => route(`/inspection/lists/${enc(list)}`),

  // The gateway's staff
  /** The operations console's landing: the workspaces the signed-in member's roles open ("Việc của tôi") */
  ops: () => route("/ops"),
  /** Returns this browser's world to the seed and signs out (mock data only) */
  resetData: () => route("/id/reset"),

  ...registrationOpsRoutes,
  ...statusOpsRoutes,
  ...financeOpsRoutes,
  ...venuePortalRoutes,
  ...publicPagesRoutes,
  ...inspectionMoreRoutes,
  ...premisesMoreRoutes,
  ...partiesRoutes,
  ...premisesRegisterRoutes,
  ...playerOpsRoutes,
  ...venueOpsRoutes,
  ...policyRoutes,
  ...oversightRoutes,
  ...casesRoutes,
  ...noticesRoutes,
  ...engagementRoutes,
  ...artistRoutes,
  /** The governance console's role appointments. */
  roleAssignments: (params?: URLSearchParams, fragment = "") => {
    const query = params?.toString();
    return route(
      `${query ? `/org/role-assignments?${query}` : "/org/role-assignments"}${fragment}`,
    );
  },
} as const;

/**
 * A route with the attempt a form kept for it (`lib/api/flash.ts`): the page reads `?attempt=` to draw a refused
 * act or a form to correct where the act was.
 */
export function withAttempt(
  path: ReturnType<typeof route>,
  attempt: string,
): ReturnType<typeof route> {
  return route(
    `${path}${path.includes("?") ? "&" : "?"}attempt=${enc(attempt)}`,
  );
}

import { headers } from "next/headers";
import type { LoadOutcome } from "@rightone/ui";
import { countVerification } from "@/lib/mock/backend/oversight";
import { verifyCertificate } from "@/lib/mock/backend/public";
import { mockVerification, pub04Typed, type Pub04View, type VerificationView } from "@/lib/mock/public";
import { currentWorld } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/** The status record a verification found, with the fields the public may read (R19.3). */
export interface VerifiedRecord {
  /**
   * SM-03, as the public verification route words it (PUB's status words). A pending record holds no reference
   * and answers as no record, so it is never one of these.
   */
  status: "active" | "expiring" | "suspended" | "reinstated" | "revoked" | "cancelled" | "expired" | "replaced";
  /** Each of the three below where the disclosure profile in effect admits it (`DR-486`); a field withheld is absent. */
  statusSince?: string;
  validFrom?: string;
  validTo?: string;
  /**
   * The printout reference looked up, when it is the current printout of this record; null for a record reference, and
   * where the profile does not admit `representation_current`.
   */
  printout: string | null;
  /** The reference of this answer, for a person to quote in a correction request. */
  answerRef: string;
}

/**
 * The register's answer for one reference on the certificate route. `RECORD`, `ABSENT` and `UNABLE` are
 * three answers and none of them is an error: an absence is a fact about a reference, and "could not
 * tell" says in words that it is not an absence.
 */
export interface CertificateVerification {
  outcome: "record" | "absent" | "unable";
  /** The record's own reference when one was found, else the reference asked. */
  reference: string;
  /** When the source answered (`RECORD`, `ABSENT`). */
  sourceAnsweredAt: string | null;
  /** When the attempt gave up (`UNABLE`). */
  attemptEndedAt: string | null;
  record: VerifiedRecord | null;
  /** The reference of an absence, for a person to quote in a correction request; a record carries its own. */
  answerRef?: string;
}

/**
 * An answer, or a refusal with its code. Too many lookups (VERIFICATION_RATE_LIMITED) also says when the
 * requester may look up again; every other outcome carries null there.
 */
export interface VerificationOutcome extends LoadOutcome<CertificateVerification> {
  retryAfter: string | null;
}

/** What a lookup typed on SCR-PUB-04 answered, kept for the page it lands on. */
export interface VerificationAttempt {
  /** The reference as the reader typed it. */
  typed: string;
  /** The reference asked, as the address of SCR-PUB-05 carries it. */
  asked: string;
  outcome: VerificationOutcome;
}

const notConfigured: VerificationOutcome = { ...NOT_CONFIGURED, retryAfter: null };

/**
 * The requester's network address, which the volume controls count by prefix (`ALG-459`). Behind the edge
 * proxy it is the address the proxy appended last to X-Forwarded-For, never one a client wrote earlier in it;
 * the development server has no proxy, so its requests count under one local address.
 */
async function requesterAddress(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  const appended = forwarded?.split(",").at(-1)?.trim() ?? "";
  return appended === "" ? "local" : appended;
}

/**
 * The seam where `@rightone/api-client` will call
 * `GET /api/v1/public-disclosure/verifications/certificates/{reference}`: one lookup, counted against the
 * requester's volume, answered from the published status records.
 *
 * Without mock data it returns a failure rather than an empty result on purpose: an empty here would
 * tell a member of the public that no record matches their reference, which is a claim about a business
 * rather than an admission that our service is not wired up. A refusal (a malformed reference, too many
 * lookups, more than one reference) is a failure with its code.
 */
export async function lookUpCertificate(reference: string): Promise<VerificationOutcome> {
  if (!usesMockData()) return notConfigured;
  // Every answer and refusal is counted for the oversight console's outcome counts (ALG-455 step 8, SCR-PUB-19).
  const world = await currentWorld();
  return countVerification(world, "AUTHORITATIVE_PREMISES_STATUS", verifyCertificate(reference, await requesterAddress(), world));
}

/**
 * SCR-PUB-04 and SCR-PUB-05's read. A review `view` returns the canvas's answer for that state; null looks
 * the reference up.
 */
export function loadVerification(reference: string, view: VerificationView | null): Promise<VerificationOutcome> {
  if (!usesMockData()) return Promise.resolve(notConfigured);
  return view !== null ? Promise.resolve(mockVerification(reference, view)) : lookUpCertificate(reference);
}

/** SCR-PUB-04's form: the reference in the field and the answer or refusal drawn with it. */
export interface VerifyForm {
  typed: string;
  outcome: VerificationOutcome | null;
}

/**
 * SCR-PUB-04. A review `view` returns the canvas's state, with the reference it shows typed; null is the form,
 * with the refusal of the reader's last lookup and what they typed, if a lookup came back here.
 */
export async function loadVerifyForm(view: Pub04View | null, last: VerificationAttempt | null): Promise<VerifyForm> {
  if (view === null) return { typed: last?.typed ?? "", outcome: last?.outcome ?? null };
  const typed = usesMockData() ? pub04Typed(view) : "";
  return { typed, outcome: view === "form" || view === "checking" ? null : await loadVerification(typed, view) };
}

/** The requester's network address, for the volume controls of the Player, licence and proof routes too (SCR-PUB-06, 07). */
export { requesterAddress };

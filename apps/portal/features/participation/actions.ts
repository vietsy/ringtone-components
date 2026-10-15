"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  REPERTOIRES,
  RIGHTS,
  TERRITORIES,
  loadApplicationForm,
  lodgeObjection,
  proposeScopeAmendment,
  saveApplicationDraft,
  submitApplication,
  type AmendmentAttempt,
  type ApplicationAttempt,
  type ApplicationContact,
  type ApplicationFields,
  type ContactRole,
  type EvidenceFile,
  type ObjectionAttempt,
  type ObjectionKind,
  type ScopeKey,
} from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { every, oneOf, readDate, someOf, text } from "./fields";

/*
 * The participation screens' acts. Each asks who is signed in, sends its command through the seam for the
 * administrator's own organisation, and opens the screen the board says comes next. A refused act goes back to
 * the page it was made on with the attempt kept (`keepForPage`), so the page draws the refusal where the act
 * was, with the values as entered.
 */

const CONTACT_ROLES: readonly ContactRole[] = ["admin", "legal"];
const OBJECTION_KINDS: readonly ObjectionKind[] = ["objection", "correction", "erasure"];
const FILE_KINDS: readonly EvidenceFile["kind"][] = ["pdf", "image", "other"];

/**
 * The documents the form lists, as the browser sends them back. One already recorded keeps what was recorded;
 * any other is new, recorded when the draft is saved. Only a name, a kind and a size are kept: there is no
 * document store to hand the file to yet.
 */
function evidenceFiles(sent: string, recorded: readonly EvidenceFile[]): EvidenceFile[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sent === "" ? "[]" : sent);
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry: unknown): EvidenceFile[] => {
    const file = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    const name = typeof file.name === "string" ? file.name.trim().slice(0, 255) : "";
    if (name === "") return [];
    const known = recorded.find((kept) => kept.name === name && kept.at !== null && kept.at === file.at);
    if (known !== undefined) return [known];
    const sizeBytes = typeof file.sizeBytes === "number" && Number.isFinite(file.sizeBytes) && file.sizeBytes >= 0 ? file.sizeBytes : 0;
    return [{ name, kind: oneOf(typeof file.kind === "string" ? file.kind : "", FILE_KINDS) ?? "other", sizeBytes, at: null, by: null }];
  });
}

/** SCR-CAT-01's form as it was sent. */
function applicationFields(form: FormData, recorded: readonly EvidenceFile[]): ApplicationFields {
  const names = every(form, "contact_name");
  const roles = every(form, "contact_role");
  const addresses = every(form, "contact_address");
  const contacts: ApplicationContact[] = names.map((name, index) => ({
    name,
    role: oneOf(roles[index] ?? "", CONTACT_ROLES),
    address: addresses[index] ?? "",
  }));
  return {
    applyingAs: oneOf(text(form, "applying_as"), ["holder", "intermediary"] as const),
    evidenceRef: text(form, "authority_evidence_ref"),
    evidenceFiles: evidenceFiles(text(form, "evidence_files"), recorded),
    contacts,
    layers: someOf(every(form, "rights_layer"), RIGHTS),
    repertoires: someOf(every(form, "repertoire"), REPERTOIRES),
    territories: someOf(every(form, "territory"), TERRITORIES),
    periodFrom: readDate(text(form, "period-from")),
    periodTo: readDate(text(form, "period-to")),
  };
}

// ---------------------------------------------------------------- SCR-CAT-01

/**
 * SCR-CAT-01 Save draft and Submit application. Save keeps everything as entered and stays on the form, which
 * then states the time saved. Submit creates the participation at APPLIED and opens SCR-CAT-02; refused, the
 * form comes back with the refusal against its fields and every value as typed, and nothing is created.
 */
export async function actOnApplication(formData: FormData): Promise<void> {
  const cmo = await requireCmo();
  const recorded = (await loadApplicationForm(cmo, null)).data?.fields.evidenceFiles ?? [];
  const fields = applicationFields(formData, recorded);
  if (text(formData, "intent") !== "submit") {
    await saveApplicationDraft(cmo, fields);
    redirect(routes.orgApply());
  }
  const answer = (await submitApplication(cmo, fields)).data;
  if (answer === null) redirect(routes.orgApply());
  if (answer.refusal === null) redirect(routes.orgParticipation());
  const attempt: ApplicationAttempt = { page: "apply", fields, refusal: answer.refusal };
  redirect(withAttempt(routes.orgApply(), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-CAT-03

/**
 * SCR-CAT-03 Submit for approval. Accepted, the amendment waits for a legal approver and SCR-CAT-02 lists it;
 * refused, the form comes back with the refusal under the field it names.
 */
export async function proposeAmendment(formData: FormData): Promise<void> {
  const cmo = await requireCmo();
  const rights = every(formData, "add_right");
  const repertoires = every(formData, "add_repertoire");
  const territories = every(formData, "add_territory");
  const rows = rights.map((right, index) => ({
    right: oneOf(right, RIGHTS),
    repertoire: oneOf(repertoires[index] ?? "", REPERTOIRES),
    territory: oneOf(territories[index] ?? "", TERRITORIES),
  }));
  // A row left wholly empty asks for nothing; a row half chosen is refused at its first empty choice.
  const additions: ScopeKey[] = [];
  const unfinished: string[] = [];
  for (const [index, { right, repertoire, territory }] of rows.entries()) {
    if (right !== null && repertoire !== null && territory !== null) additions.push({ right, repertoire, territory });
    else if (right !== null || repertoire !== null || territory !== null) {
      unfinished.push(`${right === null ? "add_right" : repertoire === null ? "add_repertoire" : "add_territory"}.${String(index)}`);
    }
  }
  const incomplete = unfinished[0] ?? null;
  const removals = every(formData, "removals").filter((key) => key !== "");
  const effectiveFrom = readDate(text(formData, "effective_from"));

  const answer = (await proposeScopeAmendment(cmo, { additions, incomplete, removals, effectiveFrom })).data;
  if (answer === null) redirect(routes.orgAmendScope());
  if (answer.refusal === null) redirect(routes.orgParticipation());
  if (answer.refusal.code === "PARTICIPATION_NOT_ACTIVE") redirect(routes.orgParticipation());
  const attempt: AmendmentAttempt = { page: "amend", additions: rows, removals, effectiveFrom, refusal: answer.refusal };
  redirect(withAttempt(routes.orgAmendScope(), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-CAT-25

/**
 * SCR-CAT-25 Lodge, after its confirmation. Accepted, the screen reads the objection back with its due date;
 * refused, it shows the refusal with the request as written.
 */
export async function lodgeAnswer(decision: string, formData: FormData): Promise<void> {
  const cmo = await requireCmo();
  const requested = oneOf(text(formData, "request_kind"), OBJECTION_KINDS);
  const ground = text(formData, "ground").slice(0, 4000);
  const answer = (await lodgeObjection(cmo, { decision, requested, ground })).data;
  if (answer === null || answer.refusal === null) redirect(routes.orgObjection(decision));
  const attempt: ObjectionAttempt = { page: "objection", decision, requested, ground, refusal: answer.refusal };
  redirect(withAttempt(routes.orgObjection(decision), keepForPage(attempt)));
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  sendHelpRouteConfirmation,
  sendHelpRouteEdit,
  sendHelpRouteRetirement,
  sendNewHelpRoute,
  sendNewVersion,
  sendVersionDecision,
  sendVersionEdit,
  sendVersionSubmission,
  sendVersionWithdrawal,
  type HelpResponsible,
  type HelpResponsibleDestination,
  type PolicyRefusal,
  type RouteInput,
  type SourceKind,
  type VersionInput,
} from "@/lib/api/public";
import { requireStaff } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";
import { field, type PolicyAttempt } from "./console";

const SOURCE_KINDS: readonly SourceKind[] = ["INSTRUMENT", "MANDATES", "PARTICIPANTS", "TARIFF", "AMNESTY"];
const RESPONSIBLE: readonly HelpResponsible[] = ["support", "complaints", "corrections", "office", "dpo"];

const attempt = (on: string, act: string, fields: Partial<Omit<PolicyAttempt, "on" | "act">> = {}): string =>
  keepForPage({ on, act, refusal: null, missing: null, typed: {}, values: {}, ...fields } satisfies PolicyAttempt);

/** A field as typed, untrimmed: the text of a version keeps its own line breaks and spacing. */
function textOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** A version's form: its label, its text, and a source version per kind the document describes (`source-<KIND>`). */
function versionInput(form: FormData): VersionInput {
  return {
    label: field(form, "version_label"),
    body: textOf(form, "body"),
    sources: SOURCE_KINDS.flatMap((kind) => (form.has(`source-${kind}`) ? [{ kind, ref: field(form, `source-${kind}`) }] : [])),
  };
}

/** What the version's form had, drawn back after a refusal. */
const typedVersion = (form: FormData, input: VersionInput): Record<string, string> => ({
  version_label: input.label,
  body: input.body,
  effective_from: field(form, "effective_from"),
  ...Object.fromEntries(input.sources.map((source) => [`source-${source.kind}`, source.ref])),
});

function revalidatePolicy(): void {
  revalidatePath(routes.policyDocuments());
  revalidatePath(routes.policyCurrency());
}

/** SCR-PUB-15 "Tạo phiên bản": the version is drafted and the editor opens on it; a refusal stays on the new form. */
export async function createVersionAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-OPS");
  const kind = field(form, "document");
  const input = versionInput(form);
  const on = `new:${kind}`;
  if (input.label === "") redirect(withAttempt(routes.policyNewVersion(kind), attempt(on, "create", { missing: "version_label", typed: typedVersion(form, input) })));
  const answer = await sendNewVersion(staff, kind, input);
  revalidatePolicy();
  if (answer.refusal !== null) redirect(withAttempt(routes.policyNewVersion(kind), attempt(on, "create", { refusal: answer.refusal, typed: typedVersion(form, input) })));
  redirect(withAttempt(routes.policyVersion(answer.accepted.id), attempt(answer.accepted.id, "create", { values: { version: input.label } })));
}

/**
 * SCR-PUB-15 "Lưu" and "Gửi duyệt". Submitting saves what is on the form first, so nothing typed is lost, then
 * submits with the effective instant; a refusal of either comes back to the field or the header it concerns.
 */
export async function editVersionAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-OPS");
  const id = field(form, "version");
  const intent = field(form, "intent") === "submit" ? "submit" : "save";
  const input = versionInput(form);
  const typed = typedVersion(form, input);
  const back = (fields: Partial<Omit<PolicyAttempt, "on" | "act">>) => redirect(withAttempt(routes.policyVersion(id), attempt(id, intent, { typed, ...fields })));
  if (input.label === "") back({ missing: "version_label" });
  const saved = await sendVersionEdit(staff, id, input);
  revalidatePolicy();
  if (saved.refusal !== null) back({ refusal: saved.refusal });
  if (intent === "save") redirect(withAttempt(routes.policyVersion(id), attempt(id, "save", { values: { version: input.label } })));
  const effective = field(form, "effective_from");
  if (effective === "") back({ missing: "effective_from" });
  const submitted = await sendVersionSubmission(staff, id, effective);
  revalidatePolicy();
  if (submitted.refusal !== null) back({ refusal: submitted.refusal });
  redirect(withAttempt(routes.policyVersion(id), attempt(id, "submit", { values: { version: input.label } })));
}

/** "Rút phiên bản" on SCR-PUB-15 or SCR-PUB-16, confirmed with its reason; the answer is shown where it was asked. */
export async function withdrawVersionAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-OPS", "ACT-POL-APR", "ACT-LGL");
  const id = field(form, "version");
  const reason = field(form, "reason");
  const page = field(form, "from") === "review" ? routes.policyVersionReview(id) : routes.policyVersion(id);
  const answer = await sendVersionWithdrawal(staff, id, reason);
  revalidatePolicy();
  const refusal: PolicyRefusal | null = answer.refusal;
  redirect(withAttempt(page, attempt(id, "withdraw", { refusal, typed: { reason }, values: { version: field(form, "label"), reason } })));
}

/** SCR-PUB-16 "Phê duyệt và công bố" or "Trả lại", confirmed; the answer is shown on the approval page. */
export async function decideVersionAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-POL-APR", "ACT-LGL", "ACT-POL-PRE", "ACT-OPS");
  const id = field(form, "version");
  const decision = field(form, "decision") === "RETURN" ? "RETURN" : "APPROVE";
  const reason = field(form, "reason");
  const plain = form.get("plain_language_confirmed") === "on";
  const answer = await sendVersionDecision(staff, id, { decision, plainLanguageConfirmed: plain, reason });
  revalidatePolicy();
  redirect(
    withAttempt(
      routes.policyVersionReview(id),
      attempt(id, decision === "RETURN" ? "return" : "approve", { refusal: answer.refusal, typed: { reason, plain: plain ? "on" : "" }, values: { version: field(form, "label") } }),
    ),
  );
}

/**
 * The responsible destination the officer typed: a desk the catalogue words is kept as that desk, so the public
 * pages word it in each language; anything else is kept as typed.
 */
function responsibleOf(typed: string): HelpResponsibleDestination | null {
  if (typed === "") return null;
  const known = RESPONSIBLE.find((key) => [vi[`pub.responsible.${key}`], en[`pub.responsible.${key}`]].some((word) => word.toLowerCase() === typed.toLowerCase()));
  return known ?? { name: typed };
}

function routeInput(form: FormData): RouteInput {
  return {
    purpose: field(form, "route_kind"),
    journeys: form.getAll("journeys").filter((value): value is string => typeof value === "string"),
    destinationKind: field(form, "destination_kind"),
    destination: field(form, "destination"),
    responsible: responsibleOf(field(form, "responsible_destination")),
    publicAccess: form.get("public_access") === "on",
  };
}

/** SCR-PUB-18 "Lưu kênh" or "Thêm kênh": the register shows the answer; a refusal keeps the form open with what was typed. */
export async function saveRouteAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const id = field(form, "route");
  const input = routeInput(form);
  const answer = id === "" ? await sendNewHelpRoute(staff, input) : await sendHelpRouteEdit(staff, id, input);
  revalidatePath(routes.help());
  const typed = {
    route_kind: input.purpose,
    journeys: input.journeys,
    destination_kind: input.destinationKind,
    destination: input.destination,
    responsible_destination: field(form, "responsible_destination"),
    public_access: input.publicAccess ? "on" : "",
  };
  if (answer.refusal !== null) {
    const open = id === "" ? routes.opsHelpRoutes({ adding: true }) : routes.opsHelpRoutes({ edit: id });
    redirect(withAttempt(open, attempt("routes", id === "" ? "add" : "save", { refusal: answer.refusal, typed, values: { route: id } })));
  }
  redirect(withAttempt(routes.opsHelpRoutes(), attempt("routes", id === "" ? "add" : "save", { values: { route: answer.accepted.id } })));
}

/** SCR-PUB-18 "Xác nhận": the route is current again from now. */
export async function confirmRouteAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const id = field(form, "route");
  const answer = await sendHelpRouteConfirmation(staff, id);
  revalidatePath(routes.help());
  redirect(withAttempt(routes.opsHelpRoutes(), attempt("routes", "confirm", { refusal: answer.refusal, values: { route: id } })));
}

/** SCR-PUB-18 "Ngừng", confirmed with its reason. */
export async function retireRouteAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const id = field(form, "route");
  const reason = field(form, "reason");
  const answer = await sendHelpRouteRetirement(staff, id, reason);
  revalidatePath(routes.help());
  redirect(withAttempt(routes.opsHelpRoutes(), attempt("routes", "retire", { refusal: answer.refusal, typed: { reason }, values: { route: id } })));
}

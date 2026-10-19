"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import {
  loadTrackSearch,
  sendArchive,
  sendDefaultPlaylist,
  sendDocumentIssue,
  sendEnding,
  sendEnrolment,
  sendNewPlaylist,
  sendPairingIssue,
  sendPairingRevocation,
  sendRevision,
  sendSchedule,
  sendScheduleWithdrawal,
  sendTermsAcceptance,
  type DocumentAttempt,
  type EditorAttempt,
  type EditorItem,
  type EndingAttempt,
  type EnrolAttempt,
  type PairingAttempt,
  type PlaylistsAttempt,
  type ScheduleAttempt,
  type TermsAttempt,
  type TrackResult,
} from "@/lib/api/venue";
import { routes, withAttempt } from "@/lib/routes";
import { readDate, readTime, text } from "./fields";

/*
 * The Player screens' acts. Each asks who is signed in, sends its command through the seam, and moves the person on
 * to the screen the board says comes next. A refused act goes back to the page it was made on with the attempt kept
 * (`keepForPage`), so the page draws the refusal where the act was, with the values as entered.
 */

// ---------------------------------------------------------------- SCR-VEN-01

/** SCR-VEN-01 Enrol this premises: SCR-VEN-02 of the new service, or the refusal in place of the result panel. */
export async function enrolPremises(formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const premisesId = text(formData, "premises_id");
  if (premisesId === "") redirect(routes.playerEnrol());
  const answer = (await sendEnrolment(principal, premisesId)).data;
  if (answer === null) redirect(routes.playerEnrol());
  if (answer.accepted !== null) redirect(routes.playerTerms(answer.accepted.code));
  redirect(withAttempt(routes.playerEnrol(), keepForPage({ page: "enrol", premisesId, code: answer.refusal.code } satisfies EnrolAttempt)));
}

// ---------------------------------------------------------------- SCR-VEN-02

/**
 * SCR-VEN-02 Accept and start the service: the service page, active, or the refusal above the action row. A
 * superseded version clears the tick, because the text attested to is no longer the text in force.
 */
export async function acceptTerms(service: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const ticked = formData.has("attestation_confirmed");
  const answer = (
    await sendTermsAcceptance(principal, service, {
      termsVersion: text(formData, "terms_version"),
      termsDocumentId: text(formData, "terms_document_id"),
      shownTextDigest: text(formData, "shown_text_digest"),
      attestationConfirmed: ticked,
    })
  ).data;
  if (answer === null) redirect(routes.playerTerms(service));
  if (answer.accepted !== null) redirect(routes.playerService(service));
  const code = answer.refusal.code;
  const attempt: TermsAttempt = { page: "terms", service, code, ticked: ticked && code !== "TERMS_VERSION_SUPERSEDED" };
  redirect(withAttempt(routes.playerTerms(service), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-VEN-05

/** SCR-VEN-05 Issue a new document: the preview shows it, the one before superseded; or the code in its place. */
export async function issueDocument(service: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const answer = (await sendDocumentIssue(principal, service, text(formData, "format"))).data;
  if (answer === null || answer.accepted !== null) redirect(routes.playerDocument(service));
  redirect(withAttempt(routes.playerDocument(service), keepForPage({ page: "document", service, code: answer.refusal.code } satisfies DocumentAttempt)));
}

/** SCR-VEN-05 Download: the document in the format chosen; a format left out is refused beside the field. */
export async function downloadDocument(service: string, document: string, formData: FormData): Promise<void> {
  await requirePrincipal();
  const format = text(formData, "format");
  if (format === "pdf" || format === "html") redirect(routes.playerDocumentFile(document, format));
  redirect(withAttempt(routes.playerDocument(service), keepForPage({ page: "document", service, code: "FIELD_MISSING" } satisfies DocumentAttempt)));
}

// ---------------------------------------------------------------- SCR-VEN-06

function backToPlaylists(service: string, playlist: string, refusal: string | null): never {
  if (refusal === null) redirect(routes.playerPlaylists(service));
  redirect(withAttempt(routes.playerPlaylists(service), keepForPage({ page: "playlists", service, playlist, code: refusal } satisfies PlaylistsAttempt)));
}

/** SCR-VEN-06 Set as default: the default line changes, or the refusal beside the row. */
export async function setDefaultPlaylist(service: string, playlist: string): Promise<void> {
  const principal = await requirePrincipal();
  const answer = (await sendDefaultPlaylist(principal, service, playlist)).data;
  backToPlaylists(service, playlist, answer?.refusal?.code ?? null);
}

/** SCR-VEN-06 Archive, confirmed, with the optional reason. */
export async function archivePlaylist(service: string, playlist: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const answer = (await sendArchive(principal, service, playlist, text(formData, "reason"))).data;
  backToPlaylists(service, playlist, answer?.refusal?.code ?? null);
}

// ---------------------------------------------------------------- SCR-VEN-07

/** The items as the editor sends them: kind, id, and what the editor showed for each. */
function itemsOf(formData: FormData): EditorItem[] {
  try {
    const parsed: unknown = JSON.parse(text(formData, "items") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry: unknown) => {
      const item = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
      const kind = item.kind === "SHARED_MOOD" ? "SHARED_MOOD" : item.kind === "TRACK" ? "TRACK" : null;
      if (kind === null || typeof item.ref !== "string" || typeof item.title !== "string") return [];
      return [{ kind, ref: item.ref, title: item.title, by: typeof item.by === "string" ? item.by : null, eligible: item.eligible === true }];
    });
  } catch {
    return [];
  }
}

/**
 * SCR-VEN-07 Save: a new playlist, or the next revision of one; SCR-VEN-06 shows the row. Refused, the editor comes
 * back with every item as it was, the refusal beside the item or field it names.
 */
export async function savePlaylist(service: string, playlist: string | null, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const items = itemsOf(formData);
  const name = text(formData, "name");
  const sent = items.map(({ kind, ref }) => ({ kind, ref }));
  const answer = (playlist === null ? await sendNewPlaylist(principal, service, name, sent) : await sendRevision(principal, service, playlist, sent)).data;
  if (answer === null || answer.accepted !== null) redirect(routes.playerPlaylists(service));
  const attempt: EditorAttempt = { page: "editor", service, playlist, name, items, code: answer.refusal.code, item: answer.refusal.item };
  redirect(withAttempt(playlist === null ? routes.playerNewPlaylist(service) : routes.playerPlaylist(service, playlist), keepForPage(attempt)));
}

/** SCR-VEN-07 Search eligible tracks, answered in place: only tracks eligible at the moment of the search. */
export async function searchTracks(service: string, query: string): Promise<readonly TrackResult[]> {
  const principal = await requirePrincipal();
  return (await loadTrackSearch(principal, service, String(query))).data ?? [];
}

// ---------------------------------------------------------------- SCR-VEN-08

/** SCR-VEN-08 Add a schedule: the new row appears and the week is read again; refused, the form keeps its values. */
export async function addSchedule(service: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const values: ScheduleAttempt["values"] = {
    playlist: text(formData, "playlist_id"),
    days: formData.getAll("days_of_week").map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7),
    start: text(formData, "start_local"),
    end: text(formData, "end_local"),
    from: text(formData, "effective_from"),
    to: text(formData, "effective_to"),
    replaces: text(formData, "supersedes_schedule_id"),
  };
  const answer = (
    await sendSchedule(principal, service, {
      playlist: values.playlist,
      days: values.days,
      start: readTime(values.start) ?? values.start,
      end: readTime(values.end) ?? values.end,
      from: values.from === "" ? null : (readDate(values.from) ?? values.from),
      to: values.to === "" ? null : (readDate(values.to) ?? values.to),
      replaces: values.replaces === "" || values.replaces === "none" ? null : values.replaces,
    })
  ).data;
  if (answer === null || answer.accepted !== null) redirect(routes.playerSchedule(service));
  const field = answer.refusal.field;
  const attempt: ScheduleAttempt = {
    page: "schedule",
    service,
    values,
    code: answer.refusal.code,
    field: field === "playlist" || field === "days" || field === "end" || field === "from" || field === "replaces" ? field : null,
    schedule: null,
  };
  redirect(withAttempt(routes.playerSchedule(service), keepForPage(attempt)));
}

/** SCR-VEN-08 Withdraw, confirmed: the row shows withdrawn and the week is read again; or the refusal beside the row. */
export async function withdrawSchedule(service: string, schedule: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const answer = (await sendScheduleWithdrawal(principal, service, schedule, text(formData, "reason"))).data;
  if (answer === null || answer.accepted !== null) redirect(routes.playerSchedule(service));
  const attempt: ScheduleAttempt = {
    page: "schedule",
    service,
    values: { playlist: "", days: [], start: "", end: "", from: "", to: "", replaces: "" },
    code: answer.refusal.code,
    field: null,
    schedule,
  };
  redirect(withAttempt(routes.playerSchedule(service), keepForPage(attempt)));
}

/** SCR-VEN-08 Show the week: the week and the as-at instant as chosen, kept in the address. */
export async function showWeek(service: string, formData: FormData): Promise<void> {
  await requirePrincipal();
  const from = text(formData, "week-from");
  const to = text(formData, "week-to");
  // The as-at field sends "2026-09-30T10:15+07:00" once both parts are whole, and nothing when cleared.
  const asOf = text(formData, "as_of").replace(/\+07:00$/, "");
  redirect(routes.playerSchedule(service, { from: readDate(from) ?? from, to: readDate(to) ?? to, asOf }));
}

// ---------------------------------------------------------------- SCR-VEN-11

/** SCR-VEN-11 End the service, confirmed: SCR-VEN-04 with the pending ending; refused, the date stays. */
export async function endService(service: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const typed = text(formData, "requested_effective_date");
  const reason = text(formData, "reason");
  const answer = (await sendEnding(principal, service, typed === "" ? null : (readDate(typed) ?? typed), reason)).data;
  if (answer === null || answer.accepted !== null) redirect(routes.playerService(service));
  const attempt: EndingAttempt = { page: "ending", service, date: typed, reason, code: answer.refusal.code };
  redirect(withAttempt(routes.playerEnd(service), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-IAM-06

/** SCR-IAM-06 Issue the code: the page shows the value once, kept only in the attempt; or the refusal above the form. */
export async function issuePairing(formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const premises = text(formData, "premises_id");
  const answer = (await sendPairingIssue(principal, premises, text(formData, "purpose"))).data;
  if (answer === null) redirect(routes.playerPairing(premises));
  const attempt: PairingAttempt =
    answer.accepted !== null
      ? { page: "pairing", premises, issued: answer.accepted, code: null, revoke: null }
      : { page: "pairing", premises, issued: null, code: answer.refusal.code, revoke: null };
  redirect(withAttempt(routes.playerPairing(premises), keepForPage(attempt)));
}

/** SCR-IAM-06 Revoke, confirmed with a reason: the row shows revoked; or the refusal, the dialog's reason kept. */
export async function revokePairing(premises: string, authorisation: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const reason = text(formData, "reason");
  const answer = (await sendPairingRevocation(principal, authorisation, reason)).data;
  if (answer === null) redirect(routes.playerPairing(premises));
  const attempt: PairingAttempt = {
    page: "pairing",
    premises,
    issued: null,
    code: answer.refusal?.code ?? null,
    revoke: { id: authorisation, reason },
  };
  redirect(withAttempt(routes.playerPairing(premises), keepForPage(attempt)));
}

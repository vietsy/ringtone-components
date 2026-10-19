import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type { Credits, Delivery, DeliveryStop, DeviceCondition, EntitlementStatus, PlaylistStatus, ResolvedPeriod } from "@/lib/api/venue";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import iamEn from "@/messages/screens/iam.en.json";
import iamVi from "@/messages/screens/iam.vi.json";
import plrEn from "@/messages/screens/plr.en.json";
import plrVi from "@/messages/screens/plr.vi.json";
import venEn from "@/messages/screens/ven.en.json";
import venVi from "@/messages/screens/ven.vi.json";

/** The Player service family's translator: `ven.*` is shared by its screens, `venNN.*` belongs to one. */
export const venTranslator = (locale: Locale): Translate => translator({ vi: venVi, en: venEn }, locale);
/** The device and guest screens' translator (`plr.*`, `plr04.*`, `plr05.*`, `plr06.*`, `devices.*`). */
export const plrTranslator = (locale: Locale): Translate => translator({ vi: plrVi, en: plrEn }, locale);
/** The pairing screen's translator (`iam06.*`). */
export const iamTranslator = (locale: Locale): Translate => translator({ vi: iamVi, en: iamEn }, locale);

/*
 * Convention 7: three ways a service stops never look alike. Enforcement is danger (restriction attention), the
 * two endings info, each with a shape of its own; an active service is neutral, a fact rather than an achievement.
 */
const STATUS: Readonly<Record<EntitlementStatus, { family: Family; icon?: string }>> = {
  PENDING_TERMS: { family: "attention" },
  ACTIVE: { family: "neutral" },
  SUSPENDED: { family: "danger", icon: "pause" },
  RESTRICTED: { family: "attention" },
  REVOKED: { family: "danger", icon: "ban" },
  ENDED_AT_REQUEST: { family: "info", icon: "power" },
  ENDED_OUT_OF_SCOPE: { family: "info", icon: "circle-dashed" },
};

export function serviceStatus(status: EntitlementStatus, t: Translate): StatusValue {
  const { family, icon } = STATUS[status];
  return { family, label: t(`ven.status.${status}`), ...(icon !== undefined ? { icon } : {}) };
}

const PLAYLIST: Readonly<Record<PlaylistStatus, Family>> = { USABLE: "neutral", NO_ELIGIBLE_TRACK: "attention", ARCHIVED: "info" };

export function playlistStatus(status: PlaylistStatus, t: Translate): StatusValue {
  return { family: PLAYLIST[status], label: t(`ven.playlist.${status}`) };
}

/**
 * A refusal's sentence from the family's catalogue (`<prefix>.refusal.<code>`), split as a Banner splits it: the
 * first sentence is the title, the rest the text.
 */
export function refusalWords(code: string, t: Translate, prefix = "ven"): { title: string; text: string } {
  const sentence = t(`${prefix}.refusal.${code}`);
  const cut = sentence.indexOf(". ");
  return cut < 0 ? { title: sentence, text: "" } : { title: sentence.slice(0, cut + 1), text: sentence.slice(cut + 2) };
}

/*
 * Values put into a sentence go through the formatting layer. A value the API always sends is never missing, so
 * the empty string below is a type guard rather than a rendering.
 */
export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";
/** A clock time in Vietnam, "10:30 (GMT+7)". */
export const clock = (iso: string) => `${R1_FORMAT.formatTime(iso) ?? ""} (GMT+7)`;

/**
 * ISO weekdays as the schedule names them, a run of three or more written as a range: "Thứ hai - thứ sáu" /
 * "Mon-Fri", "Thứ bảy, chủ nhật" / "Sat, Sun". A day after the first is written as it reads mid-sentence.
 */
export function daysWords(days: readonly number[], t: Translate, midSentence = false): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return t(midSentence ? "ven.days.allAfter" : "ven.days.all");
  const run = sorted.length > 2 && sorted.every((value, index) => index === 0 || value === (sorted[index - 1] ?? 0) + 1);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const lead = (value: number) => t(midSentence ? `ven.dayAfter.${value}` : `ven.day.${value}`);
  if (run && first !== undefined && last !== undefined) return t("ven.days.range", { from: lead(first), to: t(`ven.dayAfter.${last}`) });
  return sorted.map((value, index) => (index === 0 ? lead(value) : t(`ven.dayAfter.${value}`))).join(", ");
}

/**
 * A resolved period's outcome as words with its family (SCR-VEN-08, "The words for a period's outcome"). A period is
 * an answer, not a refusal; nothing can play is the one never to be missed, in danger.
 */
export function periodOutcome(period: ResolvedPeriod, t: Translate): StatusValue {
  switch (period.outcome) {
    case "SCHEDULED":
      return { family: "neutral", label: t("ven.outcome.SCHEDULED") };
    case "DEFAULT_PLAYLIST":
      return period.reason === "SCHEDULED_PLAYLIST_UNUSABLE"
        ? { family: "attention", label: t("ven.outcome.DEFAULT_LOST", { playlist: period.lost ?? "" }) }
        : { family: "neutral", label: t("ven.outcome.DEFAULT") };
    case "FALLBACK_MOOD":
      return { family: "attention", label: t("ven.outcome.FALLBACK_MOOD") };
    case "NO_PLAYABLE_SCHEDULE":
      return { family: "danger", label: t("ven.outcome.NO_PLAYABLE_SCHEDULE") };
  }
}

/** The schedule a period's winner overlapped, said on the period's row: the later-saved plays. */
export function overlapNote(period: ResolvedPeriod, t: Translate): string | null {
  return period.overlap === null ? null : t("ven.overlap", { playlist: period.overlap.playlist, from: period.overlap.start, to: period.overlap.end });
}

/**
 * A device's condition as the venue reads it (R1-GOV-032 §8): offline is not entitlement expired, and the offline
 * limit reached is the one that stops the music. A device that nothing reaches is said with PLR-06's words and why,
 * in the family of what stopped it: the service's state as convention 7 draws it, or the credential's as IAM does.
 */
const CONDITION: Readonly<Record<DeviceCondition, Family>> = { ONLINE: "neutral", OFFLINE: "info", CEILING: "attention", LIMIT_REACHED: "danger", STOPPED: "danger" };

/** The key a stop is worded under: `plr.stop.<key>`, `plr04.stopText.<key>`, `plr04.stopDo.<key>`. */
export function stopKey(stop: DeliveryStop): string {
  if (stop.cause === "DEVICE") return `DEVICE_${stop.credential ?? "NONE"}`;
  return stop.status ?? "NONE";
}

function stopFamily(stop: DeliveryStop): { family: Family; icon?: string } {
  if (stop.cause === "DEVICE") return { family: stop.credential === "REVOKED" ? "danger" : "attention" };
  return stop.status === null ? { family: "attention" } : STATUS[stop.status];
}

/** The stop as a badge: "Lúc này chưa có nhạc", why under it in a table, the shape of what stopped it. */
function stopStatus(stop: DeliveryStop, t: Translate): StatusValue {
  const { family, icon } = stopFamily(stop);
  return { family, label: t("plr.condition.STOPPED"), detail: t(`plr.stop.${stopKey(stop)}`), ...(icon !== undefined ? { icon } : {}) };
}

export function deviceCondition(device: { condition: DeviceCondition } & Delivery, t: Translate): StatusValue {
  return device.stop !== null ? stopStatus(device.stop, t) : { family: CONDITION[device.condition], label: t(`plr.condition.${device.condition}`) };
}

/** The four governed credit roles as NowPlaying takes them; a role with no one in it is left out, drawn as a dash. */
export function creditsOf(roles: Credits): { composer?: string; lyricist?: string; performer?: string; producer?: string } {
  return {
    ...(roles.composer !== null ? { composer: roles.composer } : {}),
    ...(roles.lyricist !== null ? { lyricist: roles.lyricist } : {}),
    ...(roles.performer !== null ? { performer: roles.performer } : {}),
    ...(roles.producer !== null ? { producer: roles.producer } : {}),
  };
}

/** RightOne's public site, which a printed document's code points to. */
const PUBLIC_SITE = "rightone.vn";

/** The route a verification document prints and its QR code opens: PUB's Player verification page (SCR-PUB-06). */
export const printedRoute = (printedCode: string) => `${PUBLIC_SITE}${routes.verifyPlayer(printedCode)}`;

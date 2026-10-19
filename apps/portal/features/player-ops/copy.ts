import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type { CertificationStatus, CredentialState, DeviceStatus, SessionState, SupplierCertification } from "@/lib/api/player";
import type { CaseText } from "@/lib/api/venue";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import iamEn from "@/messages/screens/iamops.en.json";
import iamVi from "@/messages/screens/iamops.vi.json";
import plrEn from "@/messages/screens/plrops.en.json";
import plrVi from "@/messages/screens/plrops.vi.json";

/** The Player device screens' translator: `plrops.*` is shared by them, `plrNN.*` belongs to one. */
export const plropsTranslator = (locale: Locale): Translate => translator({ vi: plrVi, en: plrEn }, locale);
/** The device credential screens' translator (`iamops.*`, `iam07.*`, `iam08.*`). */
export const iamopsTranslator = (locale: Locale): Translate => translator({ vi: iamVi, en: iamEn }, locale);

/**
 * A refusal's sentence from a catalogue (`<prefix>.refusal.<code>`), split as a Banner splits it: the first sentence
 * is the title, the rest the text.
 */
export function refusalWords(code: string, t: Translate, prefix: "plrops" | "iamops"): { title: string; text: string } {
  const sentence = t(`${prefix}.refusal.${code}`);
  const cut = sentence.indexOf(". ");
  return cut < 0 ? { title: sentence, text: "" } : { title: sentence.slice(0, cut + 1), text: sentence.slice(cut + 2) };
}

/*
 * SM-200's states in words and shapes. A device lost or compromised is danger, a newly enrolled one information, a
 * suspended one attention; an active device is positive, as SCR-PLR-01 draws it, and a retired one neutral.
 */
const DEVICE: Readonly<Record<DeviceStatus, Family>> = {
  ENROLLED: "info",
  ACTIVE: "positive",
  SUSPENDED: "attention",
  LOST: "danger",
  COMPROMISED: "danger",
  TRANSFERRED: "neutral",
  RETIRED: "neutral",
};

export function deviceStatus(status: DeviceStatus, t: Translate): StatusValue {
  return { family: DEVICE[status], label: t(`plrops.status.${status}`) };
}

const SESSION: Readonly<Record<SessionState, Family>> = {
  PLAYING: "positive",
  SYNCING: "info",
  OFFLINE: "info",
  CEILING: "attention",
  FAULT: "danger",
  LIMIT_REACHED: "danger",
  STOPPED: "danger",
};

export function sessionStatus(session: { state: SessionState; hoursLeft: number | null }, t: Translate): StatusValue {
  return { family: SESSION[session.state], label: t(`plrops.session.${session.state}`, { h: session.hoursLeft ?? 0 }) };
}

/** The certification column: the end date while current, the expiry in danger, attention while there is none. */
export function certificationCell(certification: SupplierCertification, t: Translate, locale: Locale): StatusValue {
  if (certification.status === "CERTIFIED") return { family: "positive", label: day(certification.validTo ?? "", locale) };
  if (certification.status === "EXPIRED") return { family: "danger", label: t("plrops.cert.expired", { d: day(certification.validTo ?? "", locale) }) };
  return { family: "attention", label: t("plrops.cert.none") };
}

const CERTIFICATION: Readonly<Record<CertificationStatus, Family>> = {
  CERTIFIED: "positive",
  UNDER_REVIEW: "attention",
  APPLIED: "info",
  REFUSED: "danger",
  EXPIRED: "danger",
  WITHDRAWN: "danger",
};

export function certificationStatus(status: CertificationStatus, t: Translate): StatusValue {
  return { family: CERTIFICATION[status], label: t(`plrops.certStatus.${status}`) };
}

/** SM-152's three states: the difference between suspended and revoked is reversible against not. */
const CREDENTIAL: Readonly<Record<CredentialState, Family>> = { ACTIVE: "positive", SUSPENDED: "attention", REVOKED: "danger" };

export function credentialStatus(state: CredentialState, t: Translate): StatusValue {
  return { family: CREDENTIAL[state], label: t(`iamops.state.${state}`) };
}

/** Words a person at RightOne wrote, in the reader's language. */
export const said = (words: CaseText, locale: Locale) => words[locale];

/*
 * Values put into a sentence go through the formatting layer. A value the API always sends is never missing, so the
 * empty string below is a type guard rather than a rendering.
 */
export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
export const count = (n: number, locale: Locale) => R1_FORMAT.formatCount(n, locale) ?? String(n);

import { randomUUID } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type { TranslationAnswer, TranslationInput, TranslationRefusal, TranslationRegister, TranslationRow } from "@/lib/api/translations";
import { TRANSLATION_LANGUAGES } from "@/lib/mock/translations";
import { now } from "./clock";
import { contentVersions, type ContentVersion } from "./public";
import { table, type StaffRole } from "./store";

/**
 * SVC's translation register, played by the mock backend (SCR-SVC-21): one row per approved translation of a piece
 * of published content into one language, linked to the Vietnamese version it was approved against
 * (`service_ops.published_translations`), and the attribution record of every act on it, refused ones included
 * (`service_ops.attribution_records`). The Vietnamese versions are PUB's, read through `contentVersions`; a
 * translation is current while its source version is, and the supersession sweep marks it superseded from the
 * instant a later Vietnamese version takes effect. The sweep runs as the register is read, never by a timer.
 */

interface StoredTranslation {
  id: string;
  contentKey: string;
  languageCode: string;
  sourceVersion: string;
  translationState: "current" | "superseded";
  approvedBy: string;
  approvedAt: string;
  supersededAt: string | null;
  supersededByVersion: string | null;
}

/** One material act with its outcome, as `service_ops.attribution_records` keeps it; nothing alters or removes a row. */
export interface AttributionRecord {
  id: string;
  actor: string;
  actorRole: StaffRole;
  /** The permission row the act was admitted under. */
  authorityRef: string;
  actionKey: "translations.record" | "translations.read";
  objectKind: "translation" | "read";
  /** The content key, and the language and source version where the act named them. */
  objectRef: string;
  outcome: "performed" | "refused";
  /** The refusal code, or the translation recorded. */
  detail: Readonly<Record<string, string>>;
  occurredAt: string;
}

interface TranslationsState {
  translations: StoredTranslation[];
  attributions: AttributionRecord[];
}

const stateOf = (key: string): TranslationsState => table(key, "translations", () => ({ translations: [], attributions: [] }));

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });

/** The member of staff who acts, as the session names them. */
export interface TranslationActor {
  roles: readonly StaffRole[];
  name: string;
}

/** The permission row of `frd/09-permission-entries.md` both acts rest on, for the console. */
const AUTHORITY = "Record a translation and its source version";

const normalisedKey = (contentKey: string) => contentKey.trim().toUpperCase();
const ms = (instant: string) => Date.parse(instant);

function attribute(state: TranslationsState, actor: TranslationActor, act: Omit<AttributionRecord, "id" | "actor" | "actorRole" | "authorityRef" | "occurredAt">): void {
  state.attributions.push({ id: randomUUID(), actor: actor.name, actorRole: "ACT-OPS", authorityRef: AUTHORITY, occurredAt: now(), ...act });
}

/**
 * The supersession sweep: a current translation whose Vietnamese source has been followed by a later version that
 * has taken effect is superseded, stamped with the instant that version took effect and its label. A translation
 * recorded after that instant is superseded from its own approval, since a row cannot be superseded before it exists.
 */
function sweep(state: TranslationsState, contentKey: string, versions: readonly ContentVersion[]): void {
  const published = versions.filter((version) => version.status === "PUBLISHED" && version.effectiveFrom !== null);
  for (const translation of state.translations) {
    if (translation.contentKey !== contentKey || translation.translationState !== "current") continue;
    const source = published.find((version) => version.label === translation.sourceVersion);
    if (source === undefined || source.effectiveFrom === null) continue;
    const from = ms(source.effectiveFrom);
    const successor = published
      .filter((version) => ms(version.effectiveFrom ?? "") > from && ms(version.effectiveFrom ?? "") <= Date.now())
      .sort((a, b) => ms(a.effectiveFrom ?? "") - ms(b.effectiveFrom ?? ""))[0];
    if (successor === undefined || successor.effectiveFrom === null) continue;
    translation.translationState = "superseded";
    translation.supersededAt = ms(successor.effectiveFrom) >= ms(translation.approvedAt) ? successor.effectiveFrom : translation.approvedAt;
    translation.supersededByVersion = successor.label;
  }
}

/** The versions of published content: null where no public document has the key or none of its versions is published. */
function publishedContent(key: string, contentKey: string): readonly ContentVersion[] | null {
  const versions = contentVersions(key, contentKey);
  return versions !== null && versions.some((version) => version.status === "PUBLISHED") ? versions : null;
}

const rowOf = (translation: StoredTranslation, versions: readonly ContentVersion[]): TranslationRow => ({
  id: translation.id,
  languageCode: translation.languageCode,
  sourceVersion: translation.sourceVersion,
  sourcePhase: versions.find((version) => version.label === translation.sourceVersion)?.phase ?? null,
  state: translation.translationState,
  approvedBy: translation.approvedBy,
  approvedAt: translation.approvedAt,
  supersededAt: translation.supersededAt,
  supersededByVersion: translation.supersededByVersion,
});

/**
 * `GET /translations` (ACT-OPS): the translations of one content key, current ones first, with the Vietnamese version
 * in force. A key nothing is published under is CONTENT_NOT_FOUND, the refused read attributed; no row is created.
 */
export function translationRegister(key: string, actor: TranslationActor, contentKey: string): LoadOutcome<TranslationRegister> {
  if (!actor.roles.includes("ACT-OPS")) return refused("NOT_AUTHORISED");
  const state = stateOf(key);
  const asked = normalisedKey(contentKey);
  const versions = publishedContent(key, asked);
  if (versions === null) {
    attribute(state, actor, { actionKey: "translations.read", objectKind: "read", objectRef: asked, outcome: "refused", detail: { code: "CONTENT_NOT_FOUND" } });
    return refused("CONTENT_NOT_FOUND");
  }
  sweep(state, asked, versions);
  const inForce = versions.find((version) => version.phase === "IN_EFFECT") ?? null;
  return ok({
    contentKey: asked,
    inForce: inForce === null ? null : { label: inForce.label, effectiveFrom: inForce.effectiveFrom },
    versions: versions.map((version) => ({ ...version })),
    translations: state.translations
      .filter((translation) => translation.contentKey === asked)
      .map((translation) => rowOf(translation, versions))
      .sort((a, b) => Number(a.state === "superseded") - Number(b.state === "superseded") || b.approvedAt.localeCompare(a.approvedAt)),
    languages: TRANSLATION_LANGUAGES,
    readAt: now(),
  });
}

/**
 * `POST /translations` (ACT-OPS): an approved translation recorded against the Vietnamese version it was approved
 * against, current from now. Every field present first (FIELD_MISSING, the boundary check before any rule); then a
 * source version that is not approved, a draft, one awaiting approval, a withdrawn one or none of that label
 * (SOURCE_VERSION_NOT_APPROVED, naming it); then a translation into that language already recorded against that
 * version (TRANSLATION_ALREADY_RECORDED). Each attempt, refused or performed, writes its attribution record.
 */
export function recordTranslation(key: string, actor: TranslationActor, input: TranslationInput): LoadOutcome<TranslationAnswer<{ id: string }>> {
  if (!actor.roles.includes("ACT-OPS")) return refused("NOT_AUTHORISED");
  const state = stateOf(key);
  const contentKey = normalisedKey(input.contentKey);
  const languageCode = input.languageCode.trim();
  const sourceVersion = input.sourceVersion.trim();
  const named = { contentKey, languageCode, sourceVersion };
  const refuse = (code: TranslationRefusal, field: "content_key" | "language_code" | "source_version" | null): LoadOutcome<TranslationAnswer<never>> => {
    attribute(state, actor, { actionKey: "translations.record", objectKind: "translation", objectRef: contentKey, outcome: "refused", detail: { code, ...named } });
    return ok({ accepted: null, refusal: { code, field, values: named } });
  };

  if (contentKey === "") return refuse("FIELD_MISSING", "content_key");
  if (languageCode === "") return refuse("FIELD_MISSING", "language_code");
  if (sourceVersion === "") return refuse("FIELD_MISSING", "source_version");
  const versions = contentVersions(key, contentKey) ?? [];
  if (!versions.some((version) => version.label === sourceVersion && version.status === "PUBLISHED")) return refuse("SOURCE_VERSION_NOT_APPROVED", "source_version");
  const same = (translation: StoredTranslation) => translation.contentKey === contentKey && translation.languageCode === languageCode && translation.sourceVersion === sourceVersion;
  if (state.translations.some(same)) return refuse("TRANSLATION_ALREADY_RECORDED", null);

  const id = randomUUID();
  state.translations.push({ id, contentKey, languageCode, sourceVersion, translationState: "current", approvedBy: actor.name, approvedAt: now(), supersededAt: null, supersededByVersion: null });
  sweep(state, contentKey, versions);
  attribute(state, actor, { actionKey: "translations.record", objectKind: "translation", objectRef: contentKey, outcome: "performed", detail: { id, ...named } });
  return ok({ accepted: { id }, refusal: null });
}

/** The attribution records of the register, oldest first: what the assurance console reads (its screens are not built). */
export function translationAttributions(key: string, roles: readonly StaffRole[]): LoadOutcome<readonly AttributionRecord[]> {
  if (!roles.includes("ACT-OPS") && !roles.includes("ACT-AUD")) return refused("NOT_AUTHORISED");
  return ok([...stateOf(key).attributions]);
}

// ---------------------------------------------------------------- what other families call

/**
 * Which text a reader of one piece of content in one language is served now: the translation, only while one is
 * current against the Vietnamese version in force; otherwise the Vietnamese version in force, which is the
 * authoritative text in every case. A public page in a language other than Vietnamese asks this before it presents a
 * translation as current (FR-SVC-041); null where nothing is published under the key.
 */
export function servedText(key: string, contentKey: string, languageCode: string): { language: string; vietnameseVersion: string | null; sourceVersion: string | null } | null {
  const asked = normalisedKey(contentKey);
  const versions = publishedContent(key, asked);
  if (versions === null) return null;
  const state = stateOf(key);
  sweep(state, asked, versions);
  const inForce = versions.find((version) => version.phase === "IN_EFFECT")?.label ?? null;
  const current = state.translations.find(
    (translation) => translation.contentKey === asked && translation.languageCode === languageCode && translation.translationState === "current" && translation.sourceVersion === inForce,
  );
  return current !== undefined ? { language: languageCode, vietnameseVersion: inForce, sourceVersion: current.sourceVersion } : { language: "vi", vietnameseVersion: inForce, sourceVersion: null };
}

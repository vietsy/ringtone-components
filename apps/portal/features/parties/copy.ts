import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type { Act, AuthorityState, IdentificationView, PartyOrigin, PartyState, ReferenceClassView, ReviewState, Words } from "@/lib/api/parties";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/party.en.json";
import vi from "@/messages/screens/party.vi.json";

/** The party family's translator: `party.*` is shared by its screens, `ptyNN.*` belongs to one. */
export const partyTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/*
 * Values put into a sentence go through the formatting layer, so a date and a time read the same here as in every
 * component (convention 6). A value the API always sends is never missing; the empty string is a type guard.
 */
export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const shortDay = (iso: string, locale: Locale) => R1_FORMAT.formatDateShort(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
export const span = (from: string, to: string, locale: Locale) => R1_FORMAT.formatPeriod(from, to, locale) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";

/** A state's family; colour is the second signal, never the only one. */
const CODE_FAMILY: Readonly<Record<PartyState | AuthorityState | ReviewState, Family>> = {
  DRAFT: "neutral",
  IDENTIFIED: "positive",
  REFERRED: "attention",
  SUPERSEDED: "neutral",
  PENDING_START: "neutral",
  EFFECTIVE: "positive",
  EXPIRED: "neutral",
  REVOKED: "danger",
  LAPSED: "neutral",
  OPEN: "attention",
  LINKED: "neutral",
  NOT_LINKED: "neutral",
  STANDS: "neutral",
  RETURNED: "neutral",
};

/**
 * A state on the console, in the catalogue's words as every console says it; convention 7 of the screen
 * specifications draws the code here, and the console moved to words for every family.
 */
export const codeStatus = (code: PartyState | AuthorityState | ReviewState, t: Translate, quiet = false): StatusValue => ({
  family: CODE_FAMILY[code],
  label: t(`party.status.${code}`),
  ...(quiet ? { quiet: true } : {}),
});

/** The premises portal says an authority's state in words a principal uses (convention 7). */
export function authorityWords(state: AuthorityState, from: string, t: Translate, locale: Locale): StatusValue {
  if (state === "PENDING_START") return { family: "neutral", label: t("party.state.PENDING_START", { d: day(from, locale) }) };
  return { family: CODE_FAMILY[state], label: t(`party.state.${state}`) };
}

/** The acts a principal grants a delegate; granting, amending and revoking authorities stays the principal's own. */
export const DELEGATE_ACTS: readonly Act[] = ["READ", "SUBMIT", "APPROVE"];

/** What an authority lets its holder do: "Xem, nộp", the grant of authorities set apart after a semicolon. */
export function actsWords(acts: readonly Act[], t: Translate): string {
  const plain = acts.filter((act) => act !== "MANAGE_AUTHORITIES").map((act, index) => (index === 0 ? t(`party.act.${act}`) : t(`party.act.${act}`).toLocaleLowerCase()));
  const words = plain.join(", ");
  if (!acts.includes("MANAGE_AUTHORITIES")) return words;
  const manage = t("party.act.MANAGE_AUTHORITIES");
  return words === "" ? manage : `${words}; ${manage.toLocaleLowerCase()}`;
}

/** The scope of an authority: one premises by name, or the whole party. */
export const scopeWords = (premises: { name: string } | null, t: Translate) => premises?.name ?? t("party.partyWide");

/** A basis or a ground: the canvas's phrase by its code, or the principal's own words as typed. */
export const wordsOf = (value: Words, prefix: "basis" | "ground", t: Translate) => ("text" in value ? value.text : t(`party.${prefix}.${value.code}`));

/** Where a party record came from, as a sentence of the comparison and the survivor's helper. */
export function originWords(origin: PartyOrigin, t: Translate, locale: Locale): string {
  switch (origin.kind) {
    case "SOURCE":
      return origin.on !== null ? t("party.origin.source", { d: day(origin.on, locale) }) : t("party.origin.sourceUndated");
    case "MANUAL":
      return t("party.origin.manual", { d: day(origin.on, locale) });
    case "IMPORTED":
      return t("party.origin.imported", { d: day(origin.on, locale) });
    case "CREATED":
      return t("party.origin.created", { d: day(origin.on, locale), name: origin.by });
    case "DECLARED":
      return t("party.origin.declared");
  }
}

/** The facts' provenance chip: what the source answered, or what was declared. */
export const provenanceOf = (origin: PartyOrigin) => (origin.kind === "SOURCE" ? ("registry-sourced" as const) : ("declared" as const));

/** How the source stood when a declaration was made, as the declaration records it. */
export function sourceLine(identification: IdentificationView, t: Translate, locale: Locale): string {
  const declaration = identification.declaration;
  if (declaration === null) return t("party.sourceName");
  if (declaration.search !== null) return t("party.sourceNoMatch", { id: declaration.search.identifier, ts: moment(declaration.search.at, locale) });
  return t(`party.sourceCondition.${declaration.source}`);
}

/** The evidence kind: one from the approved list by its name, or as typed. */
export const evidenceWords = (kind: string, t: Translate) => (KEYS.has(`party.evidence.${kind}`) ? t(`party.evidence.${kind}`) : kind);

/** "A và B", "A, B và C": names read as a sentence names them. */
export function joinNames(names: readonly string[], t: Translate): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")}${t("party.and")}${names[names.length - 1] ?? ""}`;
}

/** What a kind of reference to the superseded record is, in the words the decision lists it by. */
export function classHelp(entry: ReferenceClassView, record: string, t: Translate, locale: Locale): string {
  switch (entry.key) {
    case "PREMISES_RELATIONSHIPS":
      return entry.endedOn !== null ? t("party.class.PREMISES_RELATIONSHIPS.ended", { names: joinNames(entry.names, t), d: day(entry.endedOn, locale) }) : t("party.class.PREMISES_RELATIONSHIPS.help", { names: joinNames(entry.names, t) });
    case "AUTHORITIES":
      return t("party.class.AUTHORITIES.help", { names: joinNames(entry.names, t) });
    case "LICENCE_HISTORY":
      return t("party.class.LICENCE_HISTORY.help");
    case "VERIFICATION_READS":
      return t("party.class.VERIFICATION_READS.help", { rec: record });
    case "CHANGE_RECORDS":
      return t("party.class.CHANGE_RECORDS.help", { rec: record, d: entry.since !== null ? day(entry.since, locale) : "" });
  }
}

/** A refusal's title and sentence from `04-refusal-codes.md`; a screen may word the title for its own act. */
export function refusal(t: Translate, code: string, screen?: string, values: Readonly<Record<string, string>> = {}): { code: string; title: string; text: string } {
  const own = screen !== undefined ? `${screen}.refusal.${code}` : null;
  const title = own !== null && KEYS.has(own) ? t(own, values) : KEYS.has(`party.refusal.${code}.title`) ? t(`party.refusal.${code}.title`, values) : t("party.refusal.FORBIDDEN.title");
  const text = KEYS.has(`party.refusal.${code}.text`) ? t(`party.refusal.${code}.text`, values) : t("party.refusal.FORBIDDEN.text");
  return { code, title, text };
}

/** Whether the family words this code as a refusal; any other failure is our outage. */
export const knownRefusal = (code: string) => KEYS.has(`party.refusal.${code}.text`);

const KEYS = new Set(Object.keys(vi));

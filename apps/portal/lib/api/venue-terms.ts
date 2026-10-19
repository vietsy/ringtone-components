import { createHash } from "node:crypto";
import type { Locale } from "@/lib/i18n/translate";
import type { TermsDocument } from "./venue";

/**
 * The service terms exactly as SCR-VEN-02 renders them, and their SHA-256 (`shown_text_digest`). The acceptance
 * attests to the text the person was shown, so the page sends the digest of what it rendered and RightOne compares
 * it with the effective document's: one function writes the text for both, so the two can never disagree on it.
 */
export function shownTermsText(terms: TermsDocument, locale: Locale): string {
  return [terms.title[locale], ...terms.sections.flatMap((section) => [section.heading[locale], section.body[locale]])].join("\n");
}

/** The 64 hexadecimal characters of the SHA-256 of the text shown. */
export function shownTermsDigest(terms: TermsDocument, locale: Locale): string {
  return createHash("sha256").update(shownTermsText(terms, locale)).digest("hex");
}

import type { LoadOutcome } from "@rightone/ui";

/**
 * SVC's translation register (SCR-SVC-21). No board draws it and no translation is recorded when a world starts: the
 * register holds only what an operations officer records in it, against the versions of the public documents PUB
 * holds (`backend/public.ts`). The backend is `backend/translations.ts`.
 */

/**
 * The languages a translation may be recorded in: those the public documents carry beside Vietnamese. Each version PUB
 * holds is written in Vietnamese and English, so English is the one.
 */
export const TRANSLATION_LANGUAGES: readonly string[] = ["en"];

/** The review states the live data never reaches: loading and our outage. */
export const TRANSLATIONS_VIEWS = ["loading", "error"] as const;
export type TranslationsView = (typeof TRANSLATIONS_VIEWS)[number];

export function mockTranslationsFailure(): LoadOutcome<never> {
  return { data: null, failure: { code: "INTERNAL_ERROR", traceId: "e2b9d4071c6f3a85", retryable: true } };
}

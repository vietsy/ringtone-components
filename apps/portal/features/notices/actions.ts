"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { sendPreferences, type PreferencesAttempt } from "@/lib/api/notices";
import { currentPrincipal, worldForAct } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { readerOf } from "./copy";

/**
 * SCR-COM-12 Save: each class's choice as the form sends it (`receive.<class>`, on or off); the suppressions are
 * recorded or released and the page says so, with any class refused SUPPRESSION_NOT_PERMITTED named beside it.
 * Without an account the notice's reference is the credential, as it is for reading the notice.
 */
export async function savePreferences(formData: FormData): Promise<void> {
  const principal = await currentPrincipal();
  const key = principal?.sessionId ?? (await worldForAct());
  const notice = formData.get("notice");
  const from = typeof notice === "string" && notice !== "" ? notice : null;
  const receive: Record<string, boolean> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("receive.") && typeof value === "string") receive[name.slice("receive.".length)] = value === "on";
  }
  const outcome = await sendPreferences(key, readerOf(principal), from, receive);
  const attempt: PreferencesAttempt = { page: "preferences", saved: outcome.data !== null, refused: outcome.data?.refused ?? [] };
  redirect(withAttempt(routes.noticePreferences(from ?? undefined), keepForPage(attempt)));
}

import { cookies } from "next/headers";
import type { Locale } from "./translate";

/** The cookie the shells' language switch writes. */
export const LOCALE_COOKIE = "r1-locale";

/**
 * The reader's locale, chosen before render so an error code and a status label read correctly in it.
 * Vietnamese unless the reader switched to English.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : "vi";
}

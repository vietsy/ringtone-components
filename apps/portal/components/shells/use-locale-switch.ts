"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Locale } from "@/lib/i18n/translate";

/** The cookie lib/i18n/locale.ts reads. Repeated here because that module reads request headers. */
const LOCALE_COOKIE = "r1-locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The shells' language switch: it writes the locale cookie and asks the router to render the page
 * again on the server, so the catalogue is chosen before render rather than swapped in the browser.
 */
export function useLocaleSwitch(): (locale: Locale) => void {
  const router = useRouter();
  return useCallback(
    (locale: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
      router.refresh();
    },
    [router],
  );
}

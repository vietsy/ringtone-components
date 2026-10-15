"use client";

import { useSyncExternalStore } from "react";
import { ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { translator, type Locale } from "@/lib/i18n/translate";
import en from "@/messages/screens/page.en.json";
import vi from "@/messages/screens/page.vi.json";

const noSubscription = () => () => undefined;

/**
 * The reader's language, from the page's own `lang`: the boundary is a client component and cannot read the
 * cookie. The server snapshot is Vietnamese, the product language, so the first render matches the server's.
 */
function useDocumentLocale(): Locale {
  return useSyncExternalStore(
    noSubscription,
    () => (document.documentElement.lang === "en" ? "en" : "vi"),
    () => "vi",
  );
}

/**
 * The last-resort boundary. It states what failed, offers Try again, and shows the digest so support can
 * find the request - the three things the frontend standard requires of an error state, and the three a
 * user needs before they can do anything but guess. The design system's error state draws all three.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useDocumentLocale();
  const t = translator({ vi, en }, locale);
  return (
    <PublicShell fill locale={locale}>
      <ViewState
        view="error"
        errorTitle={t("error.title")}
        errorText={t("error.text")}
        {...(error.digest !== undefined ? { traceId: error.digest } : {})}
        retryable
        onRetry={reset}
        density="portal"
        locale={locale}
      />
    </PublicShell>
  );
}

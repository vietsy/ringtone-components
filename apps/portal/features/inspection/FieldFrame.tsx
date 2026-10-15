import type { ReactNode } from "react";
import { ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import type { FieldDevice, RefusalCode } from "@/lib/api/inspection";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { refusalOf } from "./words";

/**
 * The field client's frame: R1's PublicShell in its field variant, with the phone's network and verification key
 * in the strip under the bar. The field client is phone-first, so the column keeps the phone's width at every
 * window size: a presenter on a laptop sees the 390 px layout the canvas draws. The frame is positioned so a
 * dialog's overlay covers all of it, as on the board.
 */
export function FieldFrame({ device, locale, children }: { device: FieldDevice | null; locale: Locale; children: ReactNode }) {
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <PublicShell
        variant="field"
        {...(device !== null ? { network: device.network, verificationKey: device.verificationKey } : {})}
        fill
        maxWidth="var(--player-width-phone)"
        locale={locale}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>{children}</div>
      </PublicShell>
    </div>
  );
}

/**
 * A failure that replaces the screen: a refusal in the family's words with its code, or our error with its
 * trace. Never an empty result.
 */
export function FieldFailure({
  failure,
  refusals,
  action,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  /** The codes this screen draws as a refusal in place of its content. */
  refusals: readonly RefusalCode[];
  /** The way on under one refusal, where the board gives one: Home under a record or an inspection not found. */
  action?: { for: RefusalCode; label: string; href: string; icon: string };
  t: Translate;
  locale: Locale;
}) {
  const code = refusals.find((known) => known === failure.code);
  if (code !== undefined) {
    const way = action !== undefined && action.for === code ? { label: action.label, href: action.href, icon: action.icon } : null;
    return (
      <ViewState
        view="refused"
        refusal={{ ...refusalOf(t, code), family: "attention", ...(way !== null ? { action: way } : {}) }}
        density="portal"
        level={2}
        locale={locale}
      />
    );
  }
  return (
    <ViewState
      view="error"
      errorTitle={t("ver.errTitle")}
      errorText={t("ver.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      density="portal"
      level={2}
      locale={locale}
    />
  );
}

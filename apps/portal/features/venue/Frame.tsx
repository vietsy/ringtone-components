import type { ReactNode } from "react";
import { Banner, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import type { Locale, Translate } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";
import type { LoadOutcome } from "@rightone/ui";
import { refusalWords, venTranslator } from "./copy";

type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;

/**
 * The premises portal around a Player page: the shell with Player current, and the bar's context - the party and
 * the person's role on the section's own pages, the premises and its service code on a service's pages, as the
 * boards draw them. The page's body is one column; a phone has the narrower gap.
 */
export function VenueShell({
  account,
  frame,
  locale,
  context,
  children,
}: {
  account: string;
  frame: Frame;
  locale: Locale;
  context: { premises: string; period?: string; label?: string } | null;
  children: ReactNode;
}) {
  const phone = frame === "phone";
  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("player", frame, locale)}
      account={account}
      {...(context !== null ? { context } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>{children}</div>
    </PortalShell>
  );
}

/** Convention 2: a read that failed is our outage, with the trace id support can search for. */
export function LoadError({ failure, locale }: { failure: Failure; locale: Locale }) {
  const t = venTranslator(locale);
  return (
    <ViewState
      view="error"
      errorTitle={t("ven.errTitle")}
      errorText={t("ven.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      density="portal"
      locale={locale}
    />
  );
}

/**
 * A refusal in place of the page's body (convention 3): information about the record, never a failure, with the
 * way back the board gives it.
 */
export function RefusedBody({
  code,
  back,
  t,
  locale,
  prefix = "ven",
}: {
  code: string;
  back: { label: string; href: string } | null;
  t: Translate;
  locale: Locale;
  prefix?: string;
}) {
  const words = refusalWords(code, t, prefix);
  return (
    <ViewState
      view="refused"
      refusal={{ code, title: words.title, text: words.text, family: "neutral", ...(back !== null ? { action: { label: back.label, href: back.href } } : {}) }}
      density="portal"
      locale={locale}
    />
  );
}

/** A refusal in the page header or above an action row: the code's sentence as a Banner, its code on the line. */
export function RefusalBanner({
  code,
  family = "neutral",
  action,
  t,
  locale,
  prefix = "ven",
  level = 2,
}: {
  code: string;
  family?: "neutral" | "attention" | "danger" | "info";
  action?: { label: string; href: string; variant?: "primary" | "secondary"; icon?: string } | undefined;
  t: Translate;
  locale: Locale;
  prefix?: string;
  level?: 2 | 3;
}) {
  const words = refusalWords(code, t, prefix);
  return (
    <Banner family={family} title={words.title} code={code} level={level} density="portal" {...(action !== undefined ? { action } : {})} live locale={locale}>
      {words.text}
    </Banner>
  );
}

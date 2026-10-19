"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/r1";
import { ConsoleShell } from "@/components/shells/ConsoleShell";
import { Text } from "@/components/Text";
import { translator, type Locale } from "@/lib/i18n/translate";
import en from "@/messages/screens/mandate-register.en.json";
import vi from "@/messages/screens/mandate-register.vi.json";

/** Administration rail in the GOV board order. Register, coverage and appointments have routes. */
const GOVERNANCE_RAIL = [
  ["mandates", "key-round"],
  ["coverage", "search"],
  ["rules", "scale"],
  ["appointments", "users"],
  ["separation", "shield-check"],
  ["projectGateway", "route"],
  ["coordination", "layout-dashboard"],
  ["recordDefinitions", "file-check"],
  ["collector", "banknote"],
  ["publicInformation", "file-text"],
  ["technicalStandards", "link"],
  ["reviewAuthority", "eye"],
] as const;

/** Shared GOV navigation. A preview queue count is shown only with server-confirmed mock data. */
export function GovernanceShell({
  account,
  locale,
  mock = false,
  current = "mandates",
  mockQueueCount = 6,
  children,
}: {
  account: string;
  locale: Locale;
  mock?: boolean;
  current?: "mandates" | "coverage" | "appointments";
  /** Fixture metadata; used only in server-confirmed mock mode. */
  mockQueueCount?: number;
  children: ReactNode;
}) {
  const t = translator({ vi, en }, locale);
  const [pending, setPending] = useState<string | null>(null);
  return (
    <ConsoleShell
      fill
      account={account}
      locale={locale}
      area={t("register.crumb.governance")}
      searchLabel={t("register.search.label")}
      onSearch={() => setPending(t("register.search.label"))}
      {...(mock
        ? {
            queueCount: mockQueueCount,
            onQueue: () => setPending(t("register.queue.title")),
          }
        : {})}
      rail={GOVERNANCE_RAIL.map(([key, icon]) => ({
        label: t(`register.nav.${key}`),
        icon,
        ...(key === "mandates" || key === "coverage" || key === "appointments"
          ? {
              href:
                key === "mandates"
                  ? "/org/mandate/register"
                  : key === "coverage"
                    ? "/org/coverage"
                    : "/org/role-assignments",
              current: key === current,
            }
          : { onClick: () => setPending(t(`register.nav.${key}`)) }),
      }))}
    >
      {children}
      {pending !== null ? (
        <Dialog
          title={pending}
          locale={locale}
          density="console"
          onClose={() => setPending(null)}
          secondaryAction={{ label: t("register.nav.close") }}
        >
          <Text>{t("register.nav.unavailable")}</Text>
        </Dialog>
      ) : null}
    </ConsoleShell>
  );
}

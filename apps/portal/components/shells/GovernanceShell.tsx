"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Dialog } from "@/components/r1";
import { Text } from "@/components/Text";
import type { Staff } from "@/lib/api/session";
import { translator, type Locale } from "@/lib/i18n/translate";
import { ConsoleShell } from "./ConsoleShell";
import {
  governanceArea,
  governanceRail,
  type GovernanceCurrent,
} from "./governance-nav";
import en from "@/messages/screens/mandate-register.en.json";
import vi from "@/messages/screens/mandate-register.vi.json";

type ShellProps = ComponentProps<typeof ConsoleShell>;

export { governanceSearchLabel } from "./governance-nav";

/**
 * The GOV counterpart to OpsFrame. It keeps the Governance rail while accepting the same staff-first
 * frame inputs as the other Operations Console screens.
 */
export function GovernanceShell({
  staff,
  searchLabel,
  keyMap,
  notice,
  locale,
  current = "mandates",
  mock = false,
  mockQueueCount = 6,
  children,
}: {
  staff: Staff;
  searchLabel: string;
  keyMap?: NonNullable<ShellProps["keyMap"]>;
  notice?: ShellProps["notice"];
  locale: Locale;
  current?: GovernanceCurrent;
  mock?: boolean;
  mockQueueCount?: number;
  children: ReactNode;
}) {
  const t = translator({ vi, en }, locale);
  const [pending, setPending] = useState<string | null>(null);

  return (
    <ConsoleShell
      area={governanceArea(locale)}
      searchLabel={searchLabel}
      onSearch={() => setPending(searchLabel)}
      rail={governanceRail(current, locale, setPending)}
      account={staff.account}
      fill
      locale={locale}
      {...(keyMap !== undefined ? { keyMap } : {})}
      {...(notice !== undefined ? { notice } : {})}
      {...(mock
        ? {
            queueCount: mockQueueCount,
            onQueue: () => setPending(t("register.queue.title")),
          }
        : {})}
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

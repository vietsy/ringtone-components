import type { ComponentProps, ReactNode } from "react";
import type { Staff } from "@/lib/api/session";
import type { Locale } from "@/lib/i18n/translate";
import { ConsoleShell } from "./ConsoleShell";
import { consoleArea, opsRail, type OpsConsole } from "./ops-nav";

type ShellProps = ComponentProps<typeof ConsoleShell>;

/**
 * The frame of every page on the gateway's consoles: R1's ConsoleShell with the console's name, the rail of
 * the workspaces the member's roles open (`current` marked), the page's search label and keys, and the member
 * signed in. A page passes its content as children and nothing else of the shell.
 */
export function OpsFrame({
  console,
  current,
  staff,
  searchLabel,
  keyMap,
  notice,
  locale,
  children,
}: {
  console: OpsConsole;
  /** The workspace the page belongs to, marked in the rail. */
  current: string;
  staff: Staff;
  /** What the bar's search finds on this console ("Tìm mã đơn hoặc cơ sở"). */
  searchLabel: string;
  /** The page's own keys, joined to the shell's list. */
  keyMap?: NonNullable<ShellProps["keyMap"]>;
  notice?: ShellProps["notice"];
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <ConsoleShell
      area={consoleArea(console, locale)}
      searchLabel={searchLabel}
      rail={opsRail(console, current, staff, locale)}
      account={staff.account}
      {...(keyMap !== undefined ? { keyMap } : {})}
      {...(notice !== undefined ? { notice } : {})}
      fill
      locale={locale}
    >
      {children}
    </ConsoleShell>
  );
}

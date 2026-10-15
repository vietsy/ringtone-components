"use client";

import type { ComponentProps } from "react";
import { ConsoleShell as R1ConsoleShell } from "@/components/r1";
import { routes } from "@/lib/routes";
import { useLocaleSwitch } from "./use-locale-switch";

type Props = Omit<ComponentProps<typeof R1ConsoleShell>, "onLocale">;

/**
 * R1's ConsoleShell with its language switch wired to the locale cookie and, wherever an account is signed in,
 * Sign out leading to the end of the session. Everything else is passed through.
 */
export function ConsoleShell({ signOut, ...props }: Props) {
  const onLocale = useLocaleSwitch();
  const way = signOut ?? (props.account !== undefined ? { href: routes.signOut() } : undefined);
  return <R1ConsoleShell {...props} {...(way !== undefined ? { signOut: way } : {})} onLocale={onLocale} />;
}

"use client";

import type { ComponentProps } from "react";
import { PublicShell as R1PublicShell } from "@/components/r1";
import { useLocaleSwitch } from "./use-locale-switch";

type Props = Omit<ComponentProps<typeof R1PublicShell>, "onLocale">;

/**
 * The portal has none of the help, privacy, contact and legal pages yet. R1 links to /help and the others
 * by default, which would be four links to a 404 at the foot of every public page; passed empty, the shell
 * draws no footer. A page that exists is passed through `links` and replaces its empty entry.
 */
const NO_LINKS = { help: "", privacy: "", contact: "", legal: "" };

/** R1's PublicShell with its language switch wired to the locale cookie and no footer link to a missing page. */
export function PublicShell({ links, ...props }: Props) {
  const onLocale = useLocaleSwitch();
  return <R1PublicShell {...props} links={{ ...NO_LINKS, ...links }} onLocale={onLocale} />;
}

"use client";

import type { ComponentProps } from "react";
import { PublicShell as R1PublicShell } from "@/components/r1";
import { routes } from "@/lib/routes";
import { useLocaleSwitch } from "./use-locale-switch";

type Props = Omit<ComponentProps<typeof R1PublicShell>, "onLocale">;

/** The foot of RightOne's public pages: help and contact (SCR-PUB-12), privacy (its privacy journey) and the legal documents (SCR-PUB-10). */
const RIGHTONE_LINKS = { help: routes.help(), privacy: routes.help({ journey: "privacy" }), contact: routes.help(), legal: routes.legalDocument() };

/**
 * Passed empty, the shell draws no footer. RightOne ID's stand-ins are another service's pages, and the inspector's
 * field client is not admitted to the public help journey, so neither links RightOne's help pages.
 */
const NO_LINKS = { help: "", privacy: "", contact: "", legal: "" };

/** R1's PublicShell with its language switch wired to the locale cookie, and RightOne's help, privacy and legal pages at its foot. */
export function PublicShell({ links, ...props }: Props) {
  const onLocale = useLocaleSwitch();
  const own = props.brand === undefined && props.variant !== "field";
  // RightOne's own public pages lead to sign-in from the bar; RightOne ID's pages and the field client do not.
  return <R1PublicShell {...(own ? { signIn: routes.signIn() } : {})} {...props} links={{ ...(own ? RIGHTONE_LINKS : NO_LINKS), ...links }} onLocale={onLocale} />;
}

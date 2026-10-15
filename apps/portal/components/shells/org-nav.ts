import type { Locale } from "@/lib/i18n/translate";
import { translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/** The organisation portal's sections, in the boards' order; the seventh is drawn on the PTY boards. */
export type OrgSection = "mandate" | "terms" | "participation" | "submit" | "submissions" | "claims" | "verify";

const SECTIONS: readonly { key: OrgSection; icon: string; href: string; needsParticipation: boolean }[] = [
  { key: "mandate", icon: "key-round", href: routes.orgMandate(), needsParticipation: false },
  { key: "terms", icon: "file-text", href: routes.orgTerms(), needsParticipation: false },
  { key: "participation", icon: "building-2", href: routes.orgParticipation(), needsParticipation: false },
  { key: "submit", icon: "upload", href: routes.orgSubmit(), needsParticipation: true },
  { key: "submissions", icon: "inbox", href: routes.orgSubmissions(), needsParticipation: true },
  { key: "claims", icon: "scale", href: routes.orgClaims(), needsParticipation: true },
  { key: "verify", icon: "shield-check", href: routes.orgVerify(), needsParticipation: false },
];

/**
 * The nav of `PortalShell` on every page of the organisation portal, with `current` marked and still a link
 * (a submission's page is under Submissions, which leads back to the one waiting). Until the organisation
 * participates, submitting records, its submissions and its claims are drawn unavailable with the reason the
 * boards give (SCR-CAT-01, SCR-PTY-17 not-registered); a suspended participation keeps them open, because
 * SCR-CAT-04 draws its own locked state for it. Labels come from the shared catalogue (`nav.org.*`).
 */
export function orgNav(current: OrgSection, participationOpen: boolean, locale: Locale) {
  const t = translator({ vi, en }, locale);
  return SECTIONS.map(({ key, icon, href, needsParticipation }) => {
    const closed = needsParticipation && !participationOpen;
    return {
      label: t(`nav.org.${key}`),
      icon,
      ...(closed ? { disabled: true, reason: t(`nav.org.closed.${key}`) } : { href }),
      ...(key === current ? { current: true } : {}),
    };
  });
}

/**
 * The shell's context line: the organisation, and under it what the page says about the reader's standing
 * (the participation's reference, "no participation yet", or the administrator's name and role), as each
 * board draws it.
 */
export function orgContext(organisationName: string, line: string, locale: Locale) {
  const t = translator({ vi, en }, locale);
  return { premises: organisationName, period: line, label: t("nav.org.context") };
}

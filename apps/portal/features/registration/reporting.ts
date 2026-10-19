import { holds, type Staff } from "@/lib/api/session";
import type { Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

export type ReportingScreen = "reports" | "policy" | "useStarts";

/**
 * The reporting and policy surface's three screens (SCR-REG-16, 17, 18) as link tabs, each offered only to the
 * roles that read it (the entry point's "by the reader's role"). The boards draw the surface as a console of its
 * own; the portal has three consoles, so it lives in the operations console's Reports workspace and its own nav is
 * these tabs.
 */
export function reportingTabs(staff: Staff, t: Translate) {
  const tabs = [
    { id: "reports", roles: ["ACT-REP", "ACT-OPS"] as const, href: routes.opsRegistrationReports() },
    { id: "policy", roles: ["ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS"] as const, href: routes.opsRegistrationPolicy() },
    { id: "useStarts", roles: ["ACT-DAT", "ACT-OPS", "ACT-POL-APR"] as const, href: routes.opsUseStarts() },
  ];
  return tabs.filter((tab) => holds(staff, ...tab.roles)).map((tab) => ({ id: tab.id, label: t(`regrep.tab.${tab.id}`), href: tab.href }));
}

import type { Route } from "next";
import type { Staff } from "@/lib/api/session";
import type { Locale } from "@/lib/i18n/translate";
import { translator } from "@/lib/i18n/translate";
import type { StaffRole } from "@/lib/mock/backend/store";
import { routes } from "@/lib/routes";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/**
 * The gateway's consoles, as the boards draw them: Operations ("Vận hành") with the workspaces of daily
 * administration, Policy ("Chính sách") for public documents and their versions, and Oversight ("Giám sát")
 * for the supervising authority. Each workspace lists the spec roles that open it; a member of staff sees only
 * the workspaces their roles open.
 *
 * `href` is null until the workspace's landing page exists: a rail entry that leads nowhere is worse than none,
 * so such an entry is left out of the rail. The work that builds a workspace's landing page sets its href here.
 */
export type OpsConsole = "operations" | "policy" | "oversight" | "security" | "evidence" | "registerData" | "approvals";

interface Workspace {
  key: string;
  icon: string;
  href: Route | null;
  roles: readonly StaffRole[];
}

const CONSOLES: Record<OpsConsole, readonly Workspace[]> = {
  operations: [
    { key: "mywork", icon: "inbox", href: routes.ops(), roles: [] },
    { key: "registration", icon: "file-text", href: routes.opsRegistration(), roles: ["ACT-OPS", "ACT-BIZ-APR", "ACT-LGL", "ACT-DAT", "ACT-REP"] },
    // The business approver decides what a premises change left behind on the business approvals console (SCR-PTY-16).
    { key: "parties", icon: "building-2", href: routes.opsParties(), roles: ["ACT-OPS", "ACT-DAT"] },
    { key: "records", icon: "shield-check", href: routes.opsStatusRecords(), roles: ["ACT-OPS", "ACT-BIZ-APR", "ACT-LGL", "ACT-AUD", "ACT-SEC"] },
    { key: "finance", icon: "banknote", href: routes.opsFinance(), roles: ["ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD"] },
    { key: "tariff", icon: "file-spreadsheet", href: routes.opsTariff(), roles: ["ACT-OPS", "ACT-FIN-OP", "ACT-AUD", "ACT-DAT"] },
    { key: "policy", icon: "scale", href: null, roles: ["ACT-POL-PRE", "ACT-POL-APR", "ACT-LGL"] },
    { key: "content", icon: "library", href: routes.opsMoods(), roles: ["ACT-MOD", "ACT-OPS"] },
    { key: "devices", icon: "tablet", href: routes.opsDevices(), roles: ["ACT-OPS"] },
    // SCR-IAM-07 and 08 sit on the operations console under "Sổ thiết bị", as the IAM frames' rail names them.
    { key: "deviceRegister", icon: "smartphone", href: routes.opsDeviceRegister(), roles: ["ACT-OPS", "ACT-SEC"] },
    { key: "services", icon: "speaker", href: routes.opsServices(), roles: ["ACT-OPS", "ACT-EVD", "ACT-LGL"] },
    // The way to the evidence console, which only the evidence operator opens; DAT's work has its own entries below.
    { key: "evidence", icon: "database", href: routes.evidenceAcceptance(), roles: ["ACT-EVD", "ACT-AUD"] },
    // DAT's "Quản trị dữ liệu" and "Bảo vệ dữ liệu cá nhân", which the DAT frames draw as consoles of their own.
    { key: "data", icon: "database", href: routes.opsProvenance(), roles: ["ACT-DAT"] },
    { key: "privacy", icon: "eye-off", href: routes.opsGeographyPolicy(), roles: ["ACT-DPO"] },
    { key: "inspection", icon: "eye", href: routes.opsInspectionAuthorities(), roles: ["ACT-OPS", "ACT-BIZ-APR"] },
    // The security owner and the data protection officer keep the protected categories' policies (SCR-CAS-18, CFG-50).
    { key: "cases", icon: "hand-heart", href: routes.opsCases(), roles: ["ACT-CAS", "ACT-DSP", "ACT-BIZ-APR", "ACT-SEC", "ACT-DPO"] },
    { key: "notices", icon: "bell", href: routes.opsNotices(), roles: ["ACT-OPS", "ACT-SUP", "ACT-BIZ-APR", "ACT-AUD"] },
    { key: "engagement", icon: "shopping-bag", href: routes.opsEngagement(), roles: ["ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD"] },
    { key: "reports", icon: "chart-column", href: routes.opsRegistrationReports(), roles: ["ACT-REP", "ACT-OPS", "ACT-AUD"] },
    // SCR-PUB-18 sits on the operations console, as its board's bar names it, in a rail entry of its own.
    { key: "helpRoutes", icon: "route", href: routes.opsHelpRoutes(), roles: ["ACT-OPS"] },
    // SCR-SVC-21, the translation register: the operations officer records each approved translation against its source.
    { key: "translations", icon: "languages", href: routes.opsTranslations(), roles: ["ACT-OPS"] },
  ],
  policy: [
    { key: "documents", icon: "file-text", href: routes.policyDocuments(), roles: ["ACT-POL-PRE", "ACT-POL-APR", "ACT-LGL", "ACT-OPS"] },
    { key: "currency", icon: "clock", href: routes.policyCurrency(), roles: ["ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS"] },
    { key: "mandates", icon: "arrow-right-left", href: routes.policyMandateChanges(), roles: ["ACT-POL-PRE", "ACT-POL-APR", "ACT-FIN-OP"] },
    { key: "engagement", icon: "hand-heart", href: routes.policyAwardRules(), roles: ["ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS", "ACT-DPO", "ACT-AUD"] },
  ],
  oversight: [
    { key: "inspections", icon: "chart-column", href: routes.oversightInspections(), roles: ["ACT-REG", "ACT-AUD"] },
    { key: "reports", icon: "file-text", href: null, roles: ["ACT-REG", "ACT-AUD", "ACT-REP", "ACT-SEC", "ACT-DPO"] },
    // The PUB frames' rail: "Tra cứu công khai" (SCR-PUB-19) and "Hồ sơ công bố" (SCR-PUB-20).
    { key: "verification", icon: "chart-column", href: routes.oversightVerificationCounts(), roles: ["ACT-REP", "ACT-SEC"] },
    { key: "disclosure", icon: "shield-check", href: routes.oversightDisclosureProfile(), roles: ["ACT-DPO", "ACT-SEC"] },
  ],
  // The evidence console ("Minh chứng"), as the PLR evidence frames' bar and rail draw it (SCR-PLR-07 to 15, and 10).
  evidence: [
    { key: "mywork", icon: "inbox", href: routes.ops(), roles: [] },
    // The auditor reads accepted evidence (PERM-484), and from it the device record (PERM-472).
    { key: "acceptance", icon: "file-check", href: routes.evidenceAcceptance(), roles: ["ACT-EVD", "ACT-AUD"] },
    { key: "integrity", icon: "shield-check", href: null, roles: ["ACT-EVD"] },
    { key: "quarantine", icon: "archive", href: null, roles: ["ACT-EVD"] },
    { key: "decisions", icon: "list-music", href: routes.evidenceDecisions(), roles: ["ACT-EVD"] },
    { key: "evidencePolicy", icon: "scale", href: null, roles: ["ACT-EVD"] },
    { key: "offlinePolicy", icon: "wifi-off", href: routes.evidenceOfflinePolicy(), roles: ["ACT-EVD"] },
    { key: "certification", icon: "tablet", href: routes.evidenceCertification(), roles: ["ACT-EVD"] },
    // SCR-PLR-11's drafting and approval, which the specification draws on no screen.
    { key: "assurancePolicy", icon: "shield-check", href: routes.evidenceAssurancePolicy(), roles: ["ACT-EVD"] },
  ],
  // The security console ("Bảo mật"), where SCR-CER-10 sits after Authority to act on the identity canvas's rail, and
  // the service continuity the SVC frames draw under "Truy cập và liên tục" (SCR-SVC-13, 14).
  security: [
    { key: "authorities", icon: "key-round", href: routes.securityPartyAuthorities(), roles: ["ACT-SEC", "ACT-AUD"] },
    { key: "keys", icon: "shield-check", href: routes.securitySigningKeys(), roles: ["ACT-SEC", "ACT-AUD"] },
    { key: "availability", icon: "chart-column", href: routes.securityAvailability(), roles: ["ACT-OPS", "ACT-SEC"] },
    { key: "locations", icon: "database", href: routes.securityLocations(), roles: ["ACT-OPS", "ACT-SEC"] },
  ],
  // The register data console ("Dữ liệu sổ đăng ký"), the data owner's, as the PTY frames' bar and rail draw it
  // (SCR-PTY-08, 14, 15); the security admin and assurance read its exceptions, and the overlap report (SCR-PTY-18).
  registerData: [
    { key: "premises", icon: "building-2", href: routes.opsPremisesRegister(), roles: ["ACT-DAT"] },
    { key: "reconciliation", icon: "refresh-cw", href: routes.opsReconciliation(), roles: ["ACT-DAT", "ACT-AUD"] },
    { key: "exceptions", icon: "triangle-alert", href: routes.opsRegisterExceptions(), roles: ["ACT-DAT", "ACT-SEC", "ACT-AUD"] },
    { key: "overlap", icon: "eye", href: routes.opsOverlapReport(), roles: ["ACT-DAT", "ACT-AUD"] },
    // FR-PTY-048's change records, which assurance and the data owner read for a period.
    { key: "changeRecords", icon: "history", href: routes.opsChangeRecords(), roles: ["ACT-DAT", "ACT-AUD"] },
  ],
  // The business approvals console ("Phê duyệt nghiệp vụ"), as SCR-PTY-16's bar and rail draw it for the approver.
  approvals: [
    { key: "mywork", icon: "inbox", href: routes.ops(), roles: ["ACT-BIZ-APR"] },
    { key: "dispositions", icon: "arrow-right-left", href: routes.opsEntitlementDispositions(), roles: ["ACT-BIZ-APR"] },
    { key: "openEnded", icon: "key-round", href: null, roles: ["ACT-BIZ-APR"] },
  ],
};

const opens = (staff: Staff, workspace: Workspace): boolean =>
  workspace.roles.length === 0 || workspace.roles.some((role) => staff.roles.includes(role));

/** The console's name in the bar ("Vận hành"), from the shared catalogue. */
export function consoleArea(console: OpsConsole, locale: Locale): string {
  return translator({ vi, en }, locale)(`console.${console}.area`);
}

/** The rail of `ConsoleShell` on every page of a console: the workspaces the member's roles open, `current` marked. */
export function opsRail(console: OpsConsole, current: string, staff: Staff, locale: Locale) {
  const t = translator({ vi, en }, locale);
  return CONSOLES[console]
    .filter((workspace) => workspace.href !== null && opens(staff, workspace))
    .map((workspace) => ({
      label: t(`nav.${console}.${workspace.key}`),
      icon: workspace.icon,
      href: workspace.href as Route,
      ...(workspace.key === current ? { current: true } : {}),
    }));
}

/** The workspaces of every console the member may open, for the operations landing ("Việc của tôi"). */
export function openWorkspaces(staff: Staff, locale: Locale) {
  const t = translator({ vi, en }, locale);
  return (Object.keys(CONSOLES) as OpsConsole[]).flatMap((console) =>
    CONSOLES[console]
      .filter((workspace) => workspace.key !== "mywork" && workspace.href !== null && opens(staff, workspace))
      .map((workspace) => ({
        console,
        key: workspace.key,
        icon: workspace.icon,
        href: workspace.href as Route,
        label: t(`nav.${console}.${workspace.key}`),
        detail: t(`nav.${console}.detail.${workspace.key}`),
      })),
  );
}

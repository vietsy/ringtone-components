import { EmptyState, NavList, PageHeader } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { openWorkspaces } from "@/components/shells/ops-nav";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import en from "@/messages/screens/ops.en.json";
import vi from "@/messages/screens/ops.vi.json";

/**
 * The operations console's landing ("Việc của tôi"): the workspaces of every console that the signed-in
 * member's roles open, each with what is done there. Signing in as staff lands here.
 */
export default async function OpsLandingPage() {
  // Signed in as a member of staff, or sent to sign in.
  const staff = await requireStaff();
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const workspaces = openWorkspaces(staff, locale);

  return (
    <OpsFrame console="operations" current="mywork" staff={staff} searchLabel={t("ops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader title={t("ops.title")} meta={t("ops.meta", { name: staff.account, position: staff.position })} locale={locale} />
        {workspaces.length > 0 ? (
          <NavList
            label={t("ops.listLabel")}
            items={workspaces.map((workspace) => ({ label: workspace.label, href: workspace.href, icon: workspace.icon, detail: workspace.detail }))}
            locale={locale}
          />
        ) : (
          <EmptyState variant="not-started" title={t("ops.emptyTitle")} level={2} density="console" locale={locale}>
            {t("ops.emptyText")}
          </EmptyState>
        )}
      </div>
    </OpsFrame>
  );
}

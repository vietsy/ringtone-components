import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ViewState } from "@/components/r1";
import {
  currentRoleAssignmentsActor,
  loadRoleAssignmentsSnapshot,
} from "@/lib/api/role-assignments";
import { requireStaff } from "@/lib/api/session";
import { usesMockData } from "@/lib/api/source";
import { getLocale } from "@/lib/i18n/locale";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { RoleAssignmentsPageClient } from "./RoleAssignmentsPageClient";
import { ROLE_ASSIGNMENTS_VIEWS, type RoleAssignmentsPageProps } from "./types";

export type { RoleAssignmentsPageProps } from "./types";

/** Staff permission and the linked holder are checked even for the loading specimen. */
export async function RoleAssignmentsPage({
  searchParams,
}: RoleAssignmentsPageProps) {
  const staff = await requireStaff("ACT-SEC");
  if ((await currentRoleAssignmentsActor()) === null) redirect(routes.ops());
  const query = await searchParams;
  const view = reviewView(query, ROLE_ASSIGNMENTS_VIEWS);
  const [locale, frame, outcome] = await Promise.all([
    getLocale(),
    getFrame(query),
    view === "loading"
      ? Promise.resolve(null)
      : loadRoleAssignmentsSnapshot(view),
  ]);

  return (
    <Suspense
      fallback={
        <ViewState
          view="loading"
          skeleton="table"
          columns={6}
          rows={5}
          density="console"
          locale={locale}
        />
      }
    >
      <RoleAssignmentsPageClient
        staff={staff}
        locale={locale}
        frame={frame}
        mock={usesMockData()}
        view={view}
        outcome={outcome}
      />
    </Suspense>
  );
}

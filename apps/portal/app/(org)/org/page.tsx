import { redirect } from "next/navigation";
import { requireCmo } from "@/lib/api/session";
import { routes } from "@/lib/routes";

/**
 * The organisation portal's landing. The governance specification lands a participant on its mandate
 * (GOV 01) and every board puts Mandate first in the nav; the catalogue specification would land on the
 * participation instead. Which comes first is open (Q-CMO-04); until it is decided, the mandate.
 */
export default async function OrgPage(): Promise<never> {
  await requireCmo();
  redirect(routes.orgMandate());
}

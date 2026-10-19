import { Suspense } from "react";
import { ViewState } from "@/components/r1";
import {
  loadMandateRegister,
  MANDATE_REGISTER_VIEWS,
} from "@/lib/api/mandate-register";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { usesMockData } from "@/lib/api/source";
import { getLocale } from "@/lib/i18n/locale";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { MandateRegisterClient } from "./MandateRegisterClient";
import type { MandateRegisterPageProps } from "./types";

export async function MandateRegisterPage({
  searchParams,
}: MandateRegisterPageProps) {
  // Review query parameters do not bypass the organisation portal's session gate.
  const reader = await requireCmo();
  const query = await searchParams;
  const view = reviewView(query, MANDATE_REGISTER_VIEWS);
  const [locale, frame, , outcome] = await Promise.all([
    getLocale(),
    getFrame(query),
    loadParticipationStanding(reader),
    view === "loading"
      ? Promise.resolve(null)
      : loadMandateRegister(reader, view),
  ]);

  return (
    <Suspense
      fallback={
        <ViewState
          view="loading"
          skeleton="table"
          columns={7}
          rows={5}
          density="console"
          locale={locale}
        />
      }
    >
      <MandateRegisterClient
        mock={usesMockData()}
        account={reader.account}
        outcome={outcome}
        locale={locale}
        frame={frame}
      />
    </Suspense>
  );
}

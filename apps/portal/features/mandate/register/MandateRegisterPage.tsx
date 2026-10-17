import { Suspense } from "react";
import { ViewState } from "@/components/r1";
import {
  loadMandateRegister,
  MANDATE_REGISTER_VIEWS,
} from "@/lib/api/mandate-register";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { MandateRegisterClient } from "./MandateRegisterClient";
import styles from "./MandateRegister.module.css";
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
    <div className={styles.page} data-frame={frame}>
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
          outcome={outcome}
          locale={locale}
          frame={frame}
        />
      </Suspense>
    </div>
  );
}

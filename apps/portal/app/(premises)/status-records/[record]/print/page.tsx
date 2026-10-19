import { PrintedSheet } from "@/features/status-records/PrintedSheet";
import { loadStatusRecordPrintout } from "@/lib/api/status-records";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { CER13_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-CER-13 Status record printout: the A4 sheet a premises displays, the record's latest printout (the one
 * Print just made) or the one `?printout=` names.
 */
export default async function StatusRecordPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ record: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Signed in as the premises principal, or sent to sign in.
  const principal = await requirePrincipal();
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, CER13_VIEWS);
  const outcome = await loadStatusRecordPrintout(
    { sessionId: principal.sessionId, party: principal.party },
    record,
    view,
    typeof query.printout === "string" ? query.printout : null,
  );

  return <PrintedSheet outcome={outcome} fit={frame === "phone"} back={{ label: t("cer12.back"), href: routes.statusRecords() }} t={t} locale={locale} />;
}

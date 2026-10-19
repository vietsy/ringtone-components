import { PrintedSheet } from "@/features/status-records/PrintedSheet";
import { requireStaff } from "@/lib/api/session";
import { loadStatusRecordPrintout } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The printout an officer's Print opens on SCR-CER-02: the same A4 sheet as SCR-CER-13, of the printout `?printout=`
 * names or the record's latest, for the officer to print and hand over.
 */
export default async function ConsolePrintoutPage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  // Only an operations officer prints from the console.
  const staff = await requireStaff("ACT-OPS");
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const key = decodeURIComponent(record);
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const outcome = await loadStatusRecordPrintout({ sessionId: staff.sessionId, party: null }, key, null, typeof query.printout === "string" ? query.printout : null);

  return <PrintedSheet outcome={outcome} fit={false} back={{ label: t("cer02.backList"), href: routes.opsStatusRecord(key) }} t={t} locale={locale} />;
}

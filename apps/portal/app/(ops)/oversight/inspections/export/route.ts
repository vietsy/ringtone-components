import { loadInspectionOversight } from "@/lib/api/inspection";
import { currentStaff, holds } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

const COUNTS = ["open", "concluded", "abandoned", "compliant", "nothingFound", "guidance", "referred", "undelivered"] as const;

/** A CSV field, quoted where it holds a separator, a quote or a line break. */
const field = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * SCR-VER-16 Export CSV: the month's inspection counts per authority, with their totals, and no name - the
 * aggregate the page shows, for the supervising authority and the auditor only.
 */
export async function GET(request: Request): Promise<Response> {
  const staff = await currentStaff();
  if (staff === null || !holds(staff, "ACT-REG", "ACT-AUD")) return new Response(null, { status: 403 });
  const query = new URL(request.url).searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const outcome = await loadInspectionOversight(staff, query.get("period"), query.get("authority"), null);
  const data = outcome.data;
  if (data === null) return new Response(null, { status: 503 });
  const header = [t("ver16.cAuth"), ...COUNTS.map((name) => t(`ver16.count.${name}`))];
  const rows = data.counts.map((row) => [row.authorityCode, ...COUNTS.map((name) => row[name])]);
  const totals = [t("ver16.total"), ...COUNTS.map((name) => data.counts.reduce((sum, row) => sum + row[name], 0))];
  const csv = [header, ...rows, totals].map((line) => line.map(field).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${t("ver16.exportFile", { p: data.period })}"`,
    },
  });
}

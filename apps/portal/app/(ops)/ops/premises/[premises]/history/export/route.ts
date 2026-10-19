import { eventWords, moment, premisesTranslator } from "@/features/parties/premises-copy";
import { loadPremisesHistory } from "@/lib/api/premises";
import { currentStaff, holds } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";

/** A CSV field, quoted where it holds a separator, a quote or a line break. */
const field = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/**
 * SCR-PTY-10 Export: the history as the page shows it, newest first, with the party-then column (FR-PTY-022), for the
 * officer and assurance who read the page.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ premises: string }> }): Promise<Response> {
  const staff = await currentStaff();
  if (staff === null || !holds(staff, "ACT-OPS", "ACT-AUD")) return new Response(null, { status: 403 });
  const record = decodeURIComponent((await params).premises);
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const outcome = await loadPremisesHistory(staff, record, null);
  const data = outcome.data;
  if (data === null) return new Response(null, { status: outcome.failure?.code === "PREMISES_NOT_FOUND" ? 404 : 503 });
  const lines = [
    [t("pty10.cWhen"), t("pty10.cWhat"), t("pty10.cParty")],
    ...data.rows.map((row) => [moment(row.at, locale), eventWords(row.what, t, locale), row.partyThen?.legalName ?? t("prm.none")]),
  ];
  const csv = lines.map((line) => line.map(field).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${t("pty10.exportFile", { r: data.record })}"`,
    },
  });
}

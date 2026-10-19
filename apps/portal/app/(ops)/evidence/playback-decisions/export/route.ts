import { R1_FORMAT } from "@rightone/formatting";
import { plropsTranslator, said } from "@/features/player-ops/copy";
import { loadDecisions } from "@/lib/api/player";
import { currentStaff, holds } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";

/** A CSV field, quoted where it holds a separator, a quote or a line break. */
const field = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * SCR-PLR-15 Export the day: every decision of the device's local day with the rule-set version applied to it, a
 * cycle restart on its own line so it is told apart from a repeat. For the evidence operator only.
 */
export async function GET(request: Request): Promise<Response> {
  const staff = await currentStaff();
  if (staff === null || !holds(staff, "ACT-EVD")) return new Response(null, { status: 403 });
  const query = new URL(request.url).searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const outcome = await loadDecisions(staff, { device: query.get("device"), day: query.get("day"), kind: null }, null);
  const data = outcome.data;
  if (data === null) return new Response(null, { status: outcome.failure?.code === "NOT_FOUND" ? 404 : 503 });
  const rules = data.rules === null ? t("plr15.csvNoRules") : t("plr15.csvRules", { v: data.rules.version });
  const header = [t("plr15.csvDevice"), t("plr15.csvDay"), t("plr15.cAt"), t("plr15.cKind"), t("plr15.cTrack"), t("plr15.cSource"), t("plr15.csvRuleSet")];
  const rows = [...data.rows].reverse().map((row) => [data.device, data.day, R1_FORMAT.formatTime(row.at) ?? "", t(`plr15.kind.${row.kind}`), said(row.title, locale), said(row.source, locale), rules]);
  const csv = [header, ...rows].map((line) => line.map(field).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${t("plr15.exportFile", { d: data.device, day: data.day })}"`,
    },
  });
}

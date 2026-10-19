import { askedDay, datTranslator, moment } from "@/features/data-governance/console";
import { loadProvenanceExport } from "@/lib/api/data-governance";
import { currentStaff, holds } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";

/** A CSV field, quoted where it holds a separator, a quote or a line break. */
const field = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/**
 * SCR-DAT-04 Export: the figure looked up and the inputs it was derived from, as at the day asked, every value with its
 * class in a column of its own (`@AC-FR-DAT-026-04`), for the data governance owner who reads the page. A figure whose
 * class cannot be resolved exports nothing: 409, PROVENANCE_CLASS_MISSING.
 */
export async function GET(request: Request): Promise<Response> {
  const staff = await currentStaff();
  if (staff === null || !holds(staff, "ACT-DAT")) return new Response(null, { status: 403 });
  const url = new URL(request.url);
  const valueRef = url.searchParams.get("value")?.trim() ?? "";
  if (valueRef === "") return new Response(null, { status: 422 });
  const typedDay = url.searchParams.get("as-of");
  const asOfDay = typedDay === null || typedDay.trim() === "" ? null : askedDay(typedDay);
  if (typedDay !== null && typedDay.trim() !== "" && asOfDay === null) return new Response(null, { status: 422 });
  const locale = await getLocale();
  const t = datTranslator(locale);
  const outcome = await loadProvenanceExport(staff, valueRef, asOfDay);
  const data = outcome.data;
  if (data === null) {
    const code = outcome.failure?.code ?? "";
    return new Response(code, { status: code === "PROVENANCE_CLASS_MISSING" ? 409 : code === "NOT_AUTHORISED" ? 403 : 503 });
  }
  const asOf = moment(data.asOf, locale);
  const lines = [
    [t("dat04.xRef"), t("dat04.xRole"), t("dat04.xClass"), t("dat04.xCode"), t("dat04.xDecided"), t("dat04.xVenues"), t("dat04.xAsOf")],
    ...data.rows.map((row) => [
      row.valueRef,
      t(`dat04.xRole.${row.role}`),
      t(`dat.class.${row.provenanceClass}`),
      row.provenanceClass,
      row.decidedBy ?? "",
      row.venues === null ? "" : String(row.venues),
      asOf,
    ]),
  ];
  const csv = lines.map((line) => line.map(field).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${t("dat04.exportFile", { r: valueRef.replace(/[^A-Za-z0-9-]+/g, "-") })}"`,
    },
  });
}

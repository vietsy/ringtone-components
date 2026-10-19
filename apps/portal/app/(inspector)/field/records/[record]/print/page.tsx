import { PrintableRecord, QrCode, ViewState } from "@/components/r1";
import { ThemeSurface } from "@/components/ThemeSurface";
import { deliveryText, findingsText, premisesAt, refusalOf, verifiedText } from "@/features/inspection/words";
import { loadInspectionRecord, type RefusalCode } from "@/lib/api/inspection";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** The refusals a read of the record gives that this sheet says in its place. */
const REFUSED: readonly RefusalCode[] = ["RECORD_NOT_FOUND", "NO_EFFECTIVE_APPOINTMENT", "APPOINTMENT_SUSPENDED", "AUTHORITY_NOT_ACTIVE"];

/**
 * SCR-VER-06 Print a copy: the whole record as the issuing authority reads it, laid out as an A4 sheet, with the
 * answers it cites and their limits, its digest, and a QR code carrying its reference, which any inspector scans or
 * types on SCR-VER-01 to confirm it. It has no shell, so the browser prints the sheet and nothing around it, or saves
 * it as a PDF; paper is the light theme whatever the screen's.
 */
export default async function FieldRecordPrintPage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  const { sessionId } = await requireInspector();
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const version = typeof query.version === "string" && /^\d+$/.test(query.version) ? Number(query.version) : null;
  const outcome = await loadInspectionRecord(sessionId, record, null, null, locale, null, version);
  const data = outcome.data;
  const whole = data?.whole ?? null;
  const fit = frame === "phone";
  const refusal: RefusalCode = REFUSED.find((code) => code === outcome.failure?.code) ?? "RECORD_NOT_FOUND";

  return (
    <ThemeSurface theme="light" locale={locale}>
      <div style={{ width: fit ? "100%" : "var(--print-a4-width)", maxWidth: "var(--print-a4-width)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {data !== null && whole !== null ? (
          <PrintableRecord
            fit={fit}
            variant="record"
            recordNoun={t("ver13.recordNoun")}
            title={t("ver13.printTitle")}
            subtitle={premisesAt(t, data.premises)}
            recordId={t("ver13.recordVersion", { r: data.reference, n: data.version })}
            issuer={data.authority}
            issued={data.issuedAt}
            codeLines={[{ label: t("ver06.lDigest"), value: data.digest }]}
            facts={[
              { label: t("ver06.lInspector"), value: t("ver06.inspector", { name: whole.inspector.name, card: whole.inspector.card }) },
              { label: t("ver06.lLocation"), value: t(`ver06.location.${whole.locationContext}`) },
              { label: t("ver06.lAt"), value: whole.inspectedAt, kind: "datetime" },
              ...(whole.delayReason !== null ? [{ label: t("ver05.delay"), value: whole.delayReason }] : []),
              {
                label: t("ver06.lVerified"),
                value: whole.verified.length > 0 ? whole.verified.map((cited) => verifiedText(t, cited, locale)).join(t("ver.listSeparator")) : t("ver06.none"),
              },
              { label: t("ver06.lFindings"), value: findingsText(t, whole.findings, "sentences") ?? t("ver06.none") },
              { label: t("ver06.lOutcome"), value: t(`ver.outcome.${data.outcome}`) },
              ...(whole.guidance !== null ? [{ label: t("ver13.lGuidance"), value: whole.guidance }] : []),
              ...(whole.referral !== null
                ? [
                    { label: t("ver05.route"), value: t(`ver.route.${whole.referral.route}`) },
                    { label: t("ver05.referralNote"), value: whole.referral.note },
                  ]
                : []),
              ...(whole.statement !== null ? [{ label: t("ver05.statement"), value: whole.statement }] : []),
              ...(whole.referralCase !== null ? [{ label: t("ver06.lReferralCase"), value: whole.referralCase, kind: "id" as const }] : []),
              ...(whole.correctedUnderCase !== null ? [{ label: t("ver06.lCorrection"), value: whole.correctedUnderCase, kind: "id" as const }] : []),
              { label: t("ver06.lState"), value: deliveryText(t, whole.delivery, locale) },
            ]}
            locale={locale}
          >
            <QrCode value={data.reference} size={160} label={t("ver06.qrLabel", { r: data.reference })} locale={locale} />
          </PrintableRecord>
        ) : (
          <div style={{ padding: "var(--space-6)" }}>
            <ViewState
              view="refused"
              refusal={{
                ...(data !== null ? { title: t("ver06.onlyIssuing"), text: "", code: "NOT_ISSUING_AUTHORITY" } : refusalOf(t, refusal)),
                family: "attention",
                action: { label: t("ver.home"), href: routes.field(), icon: "arrow-left" },
              }}
              locale={locale}
            />
          </div>
        )}
      </div>
    </ThemeSurface>
  );
}

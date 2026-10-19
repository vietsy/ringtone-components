import { PrintableRecord, ViewState } from "@/components/r1";
import { ThemeSurface } from "@/components/ThemeSurface";
import { challengeText, findingsText, followUpText, refusalOf, verifiedText } from "@/features/inspection/words";
import { loadPremisesRecord } from "@/lib/api/inspection";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VER-13 Download PDF: the record version in force as an A4 sheet carrying its reference and the tail of its
 * digest, which a later inspector confirms on SCR-VER-06. It has no shell, so the browser prints the sheet and
 * nothing around it, or saves it as a PDF; paper is the light theme whatever the screen's.
 */
export default async function InspectionRecordPrintPage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const outcome = await loadPremisesRecord(principal, record, locale);
  const data = outcome.data;
  const fit = frame === "phone";

  return (
    <ThemeSurface theme="light" locale={locale}>
      <div style={{ width: fit ? "100%" : "var(--print-a4-width)", maxWidth: "var(--print-a4-width)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {data !== null ? (
          <PrintableRecord
            fit={fit}
            variant="record"
            recordNoun={t("ver13.recordNoun")}
            title={t("ver13.printTitle")}
            subtitle={data.premises.name}
            recordId={t("ver13.recordVersion", { r: data.reference, n: data.version })}
            issuer={data.authority}
            issued={data.issuedAt}
            codeLines={[{ label: t("ver06.lDigest"), value: data.digest }]}
            facts={[
              { label: t("ver13.lAt"), value: data.inspectedAt, kind: "datetime" },
              { label: t("ver13.lInspector"), value: t("ver06.inspector", { name: data.inspector.name, card: data.inspector.card }) },
              // The delivered copy carries the limits of every answer it cites (AC-FR-VER-037-01).
              {
                label: t("ver06.lVerified"),
                value: data.verified.length > 0 ? data.verified.map((cited) => verifiedText(t, cited, locale)).join(t("ver.listSeparator")) : t("ver06.none"),
              },
              { label: t("ver13.lRecorded"), value: findingsText(t, data.findings, "sentences") ?? t("ver06.none") },
              { label: t("ver13.lOutcome"), value: t(`ver.outcome.${data.outcome}`) },
              { label: t("ver13.lGuidance"), value: data.guidance ?? t("ver06.none") },
              ...(data.referral !== null
                ? [
                    { label: t("ver05.route"), value: t(`ver.route.${data.referral.route}`) },
                    { label: t("ver05.referralNote"), value: data.referral.note },
                  ]
                : []),
              ...(data.statement !== null ? [{ label: t("ver05.statement"), value: data.statement }] : []),
              ...(data.delayReason !== null ? [{ label: t("ver05.delay"), value: data.delayReason }] : []),
              { label: t("ver13.lFollow"), value: followUpText(t, data.followUp, data.followUpBy, locale) },
              { label: t("ver13.lChallenge"), value: challengeText(t, data.challenge) },
            ]}
            locale={locale}
          />
        ) : (
          <div style={{ padding: "var(--space-6)" }}>
            <ViewState
              view="refused"
              refusal={{ ...refusalOf(t, "RECORD_NOT_FOUND"), family: "attention", action: { label: t("ver13.backToList"), href: routes.inspectionRecords(), icon: "arrow-left" } }}
              locale={locale}
            />
          </div>
        )}
      </div>
    </ThemeSurface>
  );
}

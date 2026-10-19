import { Banner, ButtonRow, Link, PrintableRecord, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { ThemeSurface } from "@/components/ThemeSurface";
import { day, printedRoute, venTranslator } from "@/features/venue/copy";
import { RefusedBody } from "@/features/venue/Frame";
import { PrintButton } from "@/features/venue/PrintButton";
import { requirePrincipal } from "@/lib/api/session";
import { loadDocumentFile } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VEN-05 Download: GET /verification-documents/{id}, the issued document as its file. Paper is the light theme
 * whatever the screen's; the browser prints it, or saves it as a PDF from its print dialog, which the PDF format
 * says how to do, and the HTML format is this page itself. A document a newer one replaced says so, since only the
 * current one verifies. A document the reader may not see is DOCUMENT_NOT_FOUND, in place of the sheet.
 */
export default async function DocumentFilePage({ params, searchParams }: { params: Promise<{ document: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ document }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const outcome = await loadDocumentFile(principal, document);
  const file = outcome.data;
  const fit = frame === "phone";
  const pdf = query.format === "pdf";

  return (
    <ThemeSurface theme="light" locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: fit ? "var(--space-4)" : "var(--space-8)", maxWidth: "var(--print-a4-width)" }}>
        {file !== null ? (
          <>
            {file.supersededAt !== null ? (
              <Banner family="info" density="portal" locale={locale}>
                {t("ven05.replaced", { d: day(file.supersededAt, locale) })}
              </Banner>
            ) : null}
            <ButtonRow>
              <PrintButton label={t("ven05.print")} locale={locale} />
              <Link href={routes.playerService(file.service)} back variant="standalone" size="touch" locale={locale}>
                {t("ven.backService")}
              </Link>
            </ButtonRow>
            {pdf ? <Text size="base">{t("ven05.pdfHow")}</Text> : null}
            <PrintableRecord
              fit={fit}
              variant="entitlement"
              title={t("ven05.docHeading")}
              subtitle={file.premises}
              status={{ family: "neutral", label: t(`ven05.atIssue.${file.statusAtIssue}`) }}
              statusAt={file.issuedAt}
              recordId={file.reference}
              issuer={t("ven05.issuer")}
              issued={file.issuedAt}
              facts={[
                { label: t("ven05.fPremises"), value: file.premises },
                { label: t("ven05.fService"), value: t("ven05.service") },
              ]}
              verifyUrl={printedRoute(file.printedCode)}
              page={1}
              pages={1}
              locale={locale}
            >
              <Text>{t("ven05.docLead")}</Text>
              <Text>{t("ven05.docFoot")}</Text>
            </PrintableRecord>
          </>
        ) : outcome.failure?.code === "DOCUMENT_NOT_FOUND" ? (
          <RefusedBody code="DOCUMENT_NOT_FOUND" back={{ label: t("ven.backServices"), href: routes.player() }} t={t} locale={locale} />
        ) : (
          <ViewState view="error" errorTitle={t("ven.errTitle")} errorText={t("ven.errText")} retryable density="portal" locale={locale} />
        )}
      </div>
    </ThemeSurface>
  );
}

import { Button, PrintableRecord, ViewState } from "@/components/r1";
import { ThemeSurface } from "@/components/ThemeSurface";
import { loadStatusRecordPrintout, type StatusRecordPrintout } from "@/lib/api/status-records";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER13_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-CER-13 Status record printout: the A4 sheet a premises displays, the record's latest printout (the one
 * Print just made). It has no shell, so the browser prints the sheet and nothing around it; paper is the light
 * theme, black on white, whatever the screen's theme.
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
  const outcome = await loadStatusRecordPrintout(principal.sessionId, record, view, typeof query.printout === "string" ? query.printout : null);
  // On a phone the preview takes the column's width, at most A4; printed, the sheet is A4 whatever the screen.
  const fit = frame === "phone";

  return (
    <ThemeSurface theme="light" locale={locale}>
      <div
        style={{
          width: fit ? "100%" : "var(--print-a4-width)",
          maxWidth: "var(--print-a4-width)",
          ...(fit ? {} : { minHeight: "var(--print-a4-height)" }),
          boxSizing: "border-box",
        }}
      >
        {outcome.data !== null ? (
          <Sheet printout={outcome.data} fit={fit} t={t} locale={locale} />
        ) : outcome.failure?.code === "REPRESENTATION_NOT_FOUND" ? (
          // The canvas draws this refusal on the record's page; a printout address with nothing behind it lands here.
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: fit ? "var(--space-6)" : "var(--space-12) var(--space-16)" }}>
            <ViewState
              view="refused"
              refusal={{ code: outcome.failure.code, title: t("cer12.npTitle"), text: t("cer12.pnfText"), family: "attention" }}
              locale={locale}
            />
            <div>
              <Button variant="secondary" size="md" icon="arrow-left" href={routes.statusRecords()} fullWidth={fit} locale={locale}>
                {t("cer12.back")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ padding: fit ? "var(--space-6)" : "var(--space-12) var(--space-16)" }}>
            <ViewState
              view="error"
              errorTitle={t("cer13.errTitle")}
              errorText={t("cer13.errText")}
              {...(outcome.failure !== null && outcome.failure.traceId !== null ? { traceId: outcome.failure.traceId } : {})}
              retryable={outcome.failure?.retryable ?? true}
              locale={locale}
            />
          </div>
        )}
      </div>
    </ThemeSurface>
  );
}

/**
 * The reading order of the record: title, reference and issuer, premises and operator, period and scope,
 * the status when printed with its caveat, then the code with the printout reference and signing key.
 */
function Sheet({ printout, fit, t, locale }: { printout: StatusRecordPrintout; fit: boolean; t: Translate; locale: Locale }) {
  return (
    <PrintableRecord
      fit={fit}
      recordNoun={t("cer13.recordNoun")}
      variant="record"
      title={t("cer13.title")}
      subtitle={printout.premises}
      status={{ label: t("cer13.status") }}
      statusAt={printout.printedAt}
      statusNote={t("cer13.reminder")}
      statusPlacement="after-facts"
      codeLines={[
        { label: t("cer13.printRef"), value: printout.printout },
        { label: t("cer13.key"), value: printout.signingKey },
      ]}
      recordId={printout.record}
      issuer={t("cer13.issuer")}
      facts={[
        // The canvas draws an address for Pasteur only; a sheet without one has no address line.
        ...(printout.address !== null ? [{ label: t("cer13.address"), value: printout.address[locale] }] : []),
        // The operator line is printed only for an organisation; a household business owner's name never is.
        ...(printout.operator !== null ? [{ label: t("cer13.operator"), value: printout.operator }] : []),
        { label: t("cer13.inForce"), value: { from: printout.period.from, to: printout.period.to }, kind: "period" as const },
        { label: t("cer13.decision"), value: printout.decision, kind: "mono" as const },
        { label: t("cer13.scope"), value: t("cer13.scopeVal") },
        { label: t("cer13.cls"), value: t("cer13.clsVal") },
      ]}
      verifyUrl={printout.verifyUrl}
      locale={locale}
    />
  );
}

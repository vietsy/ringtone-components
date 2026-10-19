import { Button, PrintableRecord, ViewState } from "@/components/r1";
import { ThemeSurface } from "@/components/ThemeSurface";
import type { StatusRecordPrintout } from "@/lib/api/status-records";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { written } from "./words";

/**
 * SCR-CER-13, the A4 sheet of one printout, as the holder prints it from the portal and an officer from the console.
 * It has no shell, so the browser prints the sheet and nothing around it; paper is the light theme, black on
 * white, whatever the screen's theme. The reading order of the record: title, reference and issuer, premises and
 * operator, period and scope, the status when printed with its caveat, then the code with the printout reference
 * and signing key.
 */
export function PrintedSheet({
  outcome,
  fit,
  back,
  t,
  locale,
}: {
  outcome: { data: StatusRecordPrintout | null; failure: { code: string; traceId: string | null; retryable: boolean } | null };
  /** On a phone the preview takes the column's width, at most A4; printed, the sheet is A4 whatever the screen. */
  fit: boolean;
  /** Where a printout that cannot be opened leads back to. */
  back: { label: string; href: string };
  t: Translate;
  locale: Locale;
}) {
  const printout = outcome.data;
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
        {printout !== null ? (
          <PrintableRecord
            fit={fit}
            recordNoun={t("cer13.recordNoun")}
            variant="record"
            // The name and the issuer are those the record copied from its definition when it issued (FR-CER-019).
            title={(printout.definition !== null ? written(printout.definition.legalName, locale) : null) ?? t("cer13.title")}
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
            issuer={(printout.definition !== null ? written(printout.definition.issuer, locale) : null) ?? t("cer13.issuer")}
            facts={[
              // The canvas draws an address for Pasteur only; a sheet without one has no address line.
              ...(printout.address !== null ? [{ label: t("cer13.address"), value: printout.address[locale] }] : []),
              // The operator line is printed only for an organisation; a household business owner's name never is.
              ...(printout.operator !== null ? [{ label: t("cer13.operator"), value: printout.operator }] : []),
              { label: t("cer13.inForce"), value: { from: printout.period.from, to: printout.period.to }, kind: "period" as const },
              ...(printout.decision !== null ? [{ label: t("cer13.decision"), value: printout.decision, kind: "mono" as const }] : []),
              { label: t("cer13.scope"), value: t("cer13.scopeVal") },
              // The class is the register's; a sheet prints none where no board draws one.
              ...(printout.premisesClass !== null ? [{ label: t("cer13.cls"), value: t(`cer.class.${printout.premisesClass}`) }] : []),
            ]}
            verifyUrl={printout.verifyUrl}
            locale={locale}
          />
        ) : outcome.failure?.code === "REPRESENTATION_NOT_FOUND" ? (
          // The canvas draws this refusal on the record's page; a printout address with nothing behind it lands here.
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: fit ? "var(--space-6)" : "var(--space-12) var(--space-16)" }}>
            <ViewState
              view="refused"
              refusal={{ code: outcome.failure.code, title: t("cer12.npTitle"), text: t("cer12.pnfText"), family: "attention" }}
              locale={locale}
            />
            <div>
              <Button variant="secondary" size="md" icon="arrow-left" href={back.href} fullWidth={fit} locale={locale}>
                {back.label}
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

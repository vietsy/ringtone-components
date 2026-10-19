import { Columns, EmptyState, FactList, Link, PageHeader, Panel, PrintableRecord, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { downloadDocument, issueDocument } from "@/features/venue/actions";
import { printedRoute, venTranslator } from "@/features/venue/copy";
import { DocumentActions } from "@/features/venue/DocumentActions";
import { LoadError, RefusalBanner, VenueShell } from "@/features/venue/Frame";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadDocumentStep, type DocumentAttempt, type DocumentStep } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN05_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VEN-05 Verification document. The document that states the premises holds the Player service, with the
 * reference anyone can check on PUB's public page: issued here, downloaded here, and replaced by the next one
 * issued. Its heading and layout are the entitlement's, never the status record's (BR-VEN-03).
 */
export default async function DocumentPage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN05_VIEWS);
  const outcome = view === "loading" ? null : await loadDocumentStep(principal, service, view);
  const last = readForPage<DocumentAttempt>(query);
  const attempt = last?.page === "document" && last.service === service ? last : null;
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={step !== null ? { premises: step.service.premises.name, period: step.service.code } : null}>
      <PageHeader
        crumbs={[
          { label: t("ven.crumb"), href: routes.player() },
          ...(step !== null ? [{ label: step.service.premises.name, href: routes.playerService(service) }] : []),
        ]}
        title={t("ven05.title")}
        locale={locale}
      />
      <Text size="base">{t("ven.line")}</Text>
      {failure !== null && failure.code === "NOT_AUTHORISED_FOR_PREMISES" ? <RefusalBanner code={failure.code} t={t} locale={locale} /> : null}
      {failure !== null && failure.code !== "NOT_AUTHORISED_FOR_PREMISES" ? <LoadError failure={failure} locale={locale} /> : null}
      {view === "loading" ? <ViewState view="loading" skeleton="card" rows={6} density="portal" locale={locale} /> : null}
      {step !== null ? <Document step={step} attempt={attempt} frame={frame} t={t} locale={locale} /> : null}
    </VenueShell>
  );
}

function Document({ step, attempt, frame, t, locale }: { step: DocumentStep; attempt: DocumentAttempt | null; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const service = step.service;
  const document = step.document;
  const pending = service.status === "PENDING_TERMS";
  // ENTITLEMENT_PENDING and WORDING_NOT_APPROVED take the preview's place; FIELD_MISSING goes beside the format.
  const bodyCode = attempt !== null && attempt.code !== "FIELD_MISSING" ? attempt.code : pending ? "ENTITLEMENT_PENDING" : null;
  return (
    <Columns single={phone}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        {bodyCode !== null ? (
          <RefusalBanner
            code={bodyCode}
            family={bodyCode === "ENTITLEMENT_PENDING" ? "attention" : "neutral"}
            {...(bodyCode === "ENTITLEMENT_PENDING" ? { action: { label: t("ven05.accept"), href: routes.playerTerms(service.code), variant: "secondary" as const } } : {})}
            t={t}
            locale={locale}
          />
        ) : document !== null ? (
          <PrintableRecord
            fit={phone}
            variant="entitlement"
            title={t("ven05.docHeading")}
            titleLevel={2}
            subtitle={document.premises}
            status={{ family: "neutral", label: t(`ven05.atIssue.${document.statusAtIssue}`) }}
            statusAt={document.issuedAt}
            recordId={document.reference}
            issuer={t("ven05.issuer")}
            issued={document.issuedAt}
            facts={[
              { label: t("ven05.fPremises"), value: document.premises },
              { label: t("ven05.fService"), value: t("ven05.service") },
            ]}
            verifyUrl={printedRoute(document.printedCode)}
            page={1}
            pages={1}
            locale={locale}
          >
            <Text>{t("ven05.docLead")}</Text>
            <Text>{t("ven05.docFoot")}</Text>
          </PrintableRecord>
        ) : (
          <EmptyState variant="not-started" title={t("ven05.emptyTitle")} level={2} action={false} density="portal" locale={locale}>
            {t("ven05.emptyText")}
          </EmptyState>
        )}
      </div>
      <Panel as="aside" title={t("ven05.asideTitle")} level={2} gap="lg" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        {document !== null && bodyCode === null ? (
          <FactList
            items={[
              { label: t("ven05.refLabel"), value: document.reference, kind: "id" },
              { label: t("ven05.issuedLabel"), value: document.issuedAt, kind: "datetime" },
              { label: t("ven05.printedLabel"), value: t("ven05.printed") },
            ]}
            locale={locale}
          />
        ) : null}
        <DocumentActions
          copy={{ format: t("ven05.format"), download: t("ven05.download"), replace: t("ven05.replace"), issue: t("ven05.issue") }}
          initialFormat={attempt?.code === "FIELD_MISSING" ? null : (document?.format ?? "pdf")}
          formatError={attempt?.code === "FIELD_MISSING" ? t("ven.refusal.FIELD_MISSING") : null}
          download={document !== null && bodyCode === null ? downloadDocument.bind(null, service.code, document.reference) : null}
          issue={issueDocument.bind(null, service.code)}
          issueBlocked={pending ? t("ven.refusal.ENTITLEMENT_PENDING") : null}
          locale={locale}
        />
        <Link href={routes.playerService(service.code)} back variant="standalone" size="touch" locale={locale}>
          {t("ven.backService")}
        </Link>
      </Panel>
    </Columns>
  );
}

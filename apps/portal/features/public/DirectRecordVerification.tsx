import { Button, PageHeader, VerificationResult, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { readForPage } from "@/lib/api/flash";
import { loadDirectRecord, type DirectRecordRoute, type DocumentLookupAttempt } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { PUB07_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";
import { publicLayout } from "./layout";
import { PageError } from "./PageError";
import { verificationRefusal } from "./verification-refusal";

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/**
 * SCR-PUB-07 Direct-licence and proof verification (D-PUB-07), one page for the two routes: the address names the
 * one read, `/verify/licence/[reference]` or `/verify/proof/[reference]`, never both, since each absence counts
 * toward the pattern control. A proof's page says first what a proof does not establish. Neither owner offers a
 * public reader yet, so an admitted reference is answered that the service could not tell, and why.
 */
export async function DirectRecordVerification({ route, reference, query }: { route: DirectRecordRoute; reference: string; query: SearchParams }) {
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the answer SCR-PUB-04 just looked up, or a lookup now.
  const view = reviewView(query, PUB07_VIEWS);
  const last = view === null ? readForPage<DocumentLookupAttempt>(query) : null;
  const { narrow, gap } = publicLayout(frame);
  const outcome =
    view === "checking" ? null : last !== null && last.route === route && last.asked === reference ? last.outcome : await loadDirectRecord(route, reference, view);
  const failure = outcome?.failure ?? null;
  const answer = outcome?.data ?? null;
  const refusal = failure !== null ? verificationRefusal(failure, outcome?.retryAfter ?? null, "pub.idHintLicence", t) : null;
  // A review view drawn on the proof is the proof's page whatever the address names.
  const shown = answer?.route ?? route;

  return (
    <PublicShell variant="verification" fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader title={t(shown === "proof" ? "pub07.proof" : "pub07.licence")} size="public" locale={locale} />
        {shown === "proof" && <Text size="base">{t("pub07.proofLimit")}</Text>}

        {view === "checking" && <VerificationResult result="checking" recordId={reference} level={2} locale={locale} />}
        {answer !== null && (
          <VerificationResult
            result="unavailable"
            title={t("pub.unable")}
            recordId={answer.reference}
            facts={[{ label: t("pub.fEnded"), value: answer.attemptEndedAt, kind: "datetime" }]}
            level={2}
            locale={locale}
          >
            <Text>{t(`pub.causeOf.${answer.cause}`)}</Text>
          </VerificationResult>
        )}
        {refusal !== null && <ViewState view="refused" refusal={refusal} level={2} density="portal" locale={locale} />}
        {failure !== null && refusal === null && <PageError failure={failure} t={t} locale={locale} />}

        <div>
          <Button variant="secondary" size="md" icon="search" href={routes.verifyOf("licence")} fullWidth={narrow} locale={locale}>
            {t("pub.again")}
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}

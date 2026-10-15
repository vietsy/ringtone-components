import { Button, ButtonRow, PageHeader, VerificationResult, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { publicLayout, readerOf } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { rateLimitedText } from "@/features/public/rate-limited";
import { VerificationAnswer } from "@/features/public/VerificationAnswer";
import { readForPage } from "@/lib/api/flash";
import { loadVerification, type VerificationAttempt } from "@/lib/api/verification";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { PUB05_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** Refusals of the lookup, which replace the answer. Their sentences are the refusal catalogue's. */
const REFUSALS: Readonly<Record<string, string>> = {
  IDENTIFIER_NOT_ACCEPTED: "pub.idTitle",
  VERIFICATION_RATE_LIMITED: "pub.rateTitle",
  ENUMERATION_NOT_PERMITTED: "pub.enumTitle",
};

/**
 * SCR-PUB-05 Verification result (D-PUB-05), opened by a certificate's QR code or from SCR-PUB-04. Read by
 * inspectors in the field and by members of the public with no relationship to the service: whether the
 * premises status record is current, its scope and term, that no record exists, or that the service could
 * not tell. The record type comes before the status; the answer never names the venue.
 */
export default async function VerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state. Otherwise the answer SCR-PUB-04 just looked up for this reference,
  // or, opened from a QR code or a link, a lookup now.
  const view = reviewView(query, PUB05_VIEWS);
  const last = view === null ? readForPage<VerificationAttempt>(query) : null;
  const reader = await readerOf(query);
  const { narrow, gap } = publicLayout(frame);
  const outcome =
    view === "checking" ? null : last !== null && last.asked === reference ? last.outcome : await loadVerification(reference, view);
  const failure = outcome?.failure ?? null;
  const answer = outcome?.data ?? null;
  const refusal = failure !== null ? (REFUSALS[failure.code] ?? null) : null;
  const recordNoun = t("pub05.recordNoun");
  const refusalText =
    failure?.code === "VERIFICATION_RATE_LIMITED"
      ? rateLimitedText(outcome?.retryAfter ?? null, t)
      : failure?.code === "ENUMERATION_NOT_PERMITTED"
        ? t("pub.enumText")
        : t("pub.idHint");

  const again = (
    <Button variant="secondary" size="md" icon="search" href={routes.verify()} fullWidth={narrow} locale={locale}>
      {t("pub05.again")}
    </Button>
  );

  return (
    <PublicShell variant="verification" fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader title={t("pub.type")} size="public" locale={locale} />

        {view === "checking" && <VerificationResult recordNoun={recordNoun} result="checking" recordId={reference} level={2} locale={locale} />}

        {answer !== null && <VerificationAnswer answer={answer} recordNoun={recordNoun} t={t} locale={locale} />}

        {failure !== null && refusal !== null && (
          <ViewState
            view="refused"
            refusal={{ code: failure.code, title: t(refusal), text: refusalText, family: "attention" }}
            level={2}
            density="portal"
            locale={locale}
          />
        )}
        {failure !== null && refusal === null && <PageError failure={failure} t={t} locale={locale} />}

        {/* The public reader's next steps are a labelled row on the canvas; an inspector, not admitted to the
            help journey, has the one way on. */}
        {reader === "public" ? <ButtonRow label={t("pub05.next")}>{again}</ButtonRow> : <div>{again}</div>}
      </div>
    </PublicShell>
  );
}

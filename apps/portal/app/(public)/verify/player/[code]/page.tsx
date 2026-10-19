import { Button, ButtonRow, PageHeader, VerificationResult, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { publicLayout, readerOf } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { PlayerAnswer } from "@/features/public/PlayerAnswer";
import { verificationRefusal } from "@/features/public/verification-refusal";
import { readForPage } from "@/lib/api/flash";
import { loadPlayerVerification, type DocumentLookupAttempt } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { PUB06_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PUB-06 Player service verification (D-PUB-06), opened by the QR code of a RightOne Player verification
 * document, or from SCR-PUB-04 with the code typed. It answers whether the premises' Player service is active, never
 * that the premises met its copyright obligations: the record type and that sentence come before any answer, and no
 * certificate word or seal is used.
 */
export default async function PlayerVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state. Otherwise the answer SCR-PUB-04 just looked up for this code, or, opened
  // from the QR code, a lookup now.
  const view = reviewView(query, PUB06_VIEWS);
  const last = view === null ? readForPage<DocumentLookupAttempt>(query) : null;
  const reader = await readerOf(query);
  const { narrow, gap } = publicLayout(frame);
  const outcome =
    view === "checking" ? null : last?.route === "player" && last.asked === code ? last.outcome : await loadPlayerVerification(code, view);
  const failure = outcome?.failure ?? null;
  const answer = outcome?.data ?? null;
  const refusal = failure !== null ? verificationRefusal(failure, outcome?.retryAfter ?? null, "pub.idHintPlayer", t) : null;

  const again = (
    <Button variant="secondary" size="md" icon="search" href={routes.verifyOf("player")} fullWidth={narrow} locale={locale}>
      {t("pub.again")}
    </Button>
  );

  return (
    <PublicShell variant="verification" fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader title={t("pub06.title")} size="public" locale={locale} />
        <Text size="base">{t("pub06.notCertificate")}</Text>

        {view === "checking" && <VerificationResult result="checking" level={2} locale={locale} />}
        {answer !== null && <PlayerAnswer answer={answer} t={t} locale={locale} />}
        {refusal !== null && <ViewState view="refused" refusal={refusal} level={2} density="portal" locale={locale} />}
        {failure !== null && refusal === null && <PageError failure={failure} t={t} locale={locale} />}

        {/* A correction is asked through the help journey, which an inspector is not admitted to. */}
        {reader === "public" ? (
          <ButtonRow label={t("pub.next")}>
            {again}
            <Button variant="quiet" size="md" href={routes.help({ from: routes.verifyPlayer(code) })} fullWidth={narrow} locale={locale}>
              {t("pub.correct")}
            </Button>
          </ButtonRow>
        ) : (
          <div>{again}</div>
        )}
      </div>
    </PublicShell>
  );
}

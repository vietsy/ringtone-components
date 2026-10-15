import { Banner, Button, Link, PageHeader, Panel, TextField, VerificationResult } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { verifyReference } from "@/features/public/actions";
import { publicLayout, readerOf } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { rateLimitedText } from "@/features/public/rate-limited";
import { VerificationAnswer } from "@/features/public/VerificationAnswer";
import { readForPage } from "@/lib/api/flash";
import { loadVerifyForm, type VerificationAttempt } from "@/lib/api/verification";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { PUB04_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** Refusals of the whole lookup, drawn above the field. A malformed reference is refused beside the field. */
const BANNERS: Readonly<Record<string, string>> = {
  VERIFICATION_RATE_LIMITED: "pub.rateTitle",
  ENUMERATION_NOT_PERMITTED: "pub.enumTitle",
};

/**
 * SCR-PUB-04 Verify a record. A member of the public or an inspector types a reference, or scans one,
 * and reaches the answer for the record it names: "Tra cứu" opens SCR-PUB-05 at the reference's address,
 * and a refused lookup comes back here with what was typed.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the form, with the reader's last refused lookup if any.
  const view = reviewView(params, PUB04_VIEWS);
  const last = view === null ? readForPage<VerificationAttempt>(params) : null;
  const reader = await readerOf(params);
  const { gap, inset } = publicLayout(frame);
  // The canvas also draws the answer in place under the form; those review views read it as SCR-PUB-05 does.
  const { typed, outcome } = await loadVerifyForm(view, last);
  const failure = outcome?.failure ?? null;
  const answer = outcome?.data ?? null;
  const banner = failure !== null ? (BANNERS[failure.code] ?? null) : null;
  const notAccepted = failure?.code === "IDENTIFIER_NOT_ACCEPTED";

  return (
    <PublicShell variant="verification" fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader title={t("pub04.title")} size="public" locale={locale} />

        {failure !== null && banner !== null && (
          <Banner family="attention" title={t(banner)} code={failure.code} density="portal" locale={locale}>
            {failure.code === "VERIFICATION_RATE_LIMITED" ? rateLimitedText(outcome?.retryAfter ?? null, t) : t("pub.enumText")}
          </Banner>
        )}

        <form action={verifyReference}>
          <Panel as="div" inset={inset} gap="md" density="portal" locale={locale}>
            <TextField
              label={t("pub04.field")}
              name="reference"
              helper={t("pub.idHint")}
              value={typed}
              {...(notAccepted ? { error: t("pub04.idError") } : {})}
              mono
              required
              autoComplete="off"
              density="portal"
              locale={locale}
            />
            <Button
              variant="primary"
              size="lg"
              icon="search"
              type="submit"
              fullWidth
              loading={view === "checking"}
              loadingLabel={t("pub04.checking")}
              locale={locale}
            >
              {t("pub04.verify")}
            </Button>
            <Text size="sm" tone="secondary">{t("pub04.qr")}</Text>
          </Panel>
        </form>

        {answer !== null && (
          <>
            <Text as="h2" size="lg" weight="semibold">{t("pub.type")}</Text>
            <VerificationAnswer answer={answer} t={t} locale={locale} />
          </>
        )}

        {view === "checking" && (
          <>
            <Text as="h2" size="lg" weight="semibold">{t("pub.type")}</Text>
            <VerificationResult result="checking" recordId={typed} level={2} locale={locale} />
          </>
        )}

        {failure !== null && banner === null && !notAccepted && <PageError failure={failure} t={t} locale={locale} />}

        {reader === "public" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2) var(--space-6)" }}>
            <Link href={routes.home()} variant="standalone" size="touch" locale={locale}>
              {t("pub.about")}
            </Link>
          </div>
        )}
      </div>
    </PublicShell>
  );
}

import { R1_FORMAT } from "@rightone/formatting";
import { Avatar, Banner, Button, Checkbox, Divider, Link, PageHeader, Panel, PasswordField, TextField, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { signIn, signInWithProvider } from "@/features/identity/actions";
import { clientOf, panelInset, providersOf, type Client } from "@/features/identity/layout";
import { readForPage } from "@/lib/api/flash";
import { loadSignInAttempt, type SignInAttempt } from "@/lib/api/identity";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { RID01_VIEWS } from "@/lib/mock/identity";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/rid.en.json";
import vi from "@/messages/screens/rid.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type BannerSpec = { family: "danger" | "attention" | "neutral"; title: string | null; text: string };

const BLANK: SignInAttempt = { email: "", password: "", remember: false, emailError: null, passwordError: null, outcome: null, reauth: false };

/**
 * SCR-RID-01 Sign in, the demonstration's stand-in for RightOne ID's page (id.rightone.vn). One sign-in for
 * every RightOne application; after it, RightOne ID asks for the two-factor code if one is set, then for the
 * organisation if the account belongs to more than one.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the page shows the reader's own last attempt, if any.
  const view = reviewView(params, RID01_VIEWS);
  const client = clientOf(params);
  const providers = providersOf(params);
  const last = readForPage<SignInAttempt>(params);
  const outcome = view !== null && view !== "form" ? await loadSignInAttempt(view) : last !== null ? { data: last, failure: null } : null;
  const failure = outcome?.failure ?? null;
  const attempt = outcome?.data ?? BLANK;
  // After an account is deleted the browser lands here with no application in the address.
  const branded = client === "rightone" && attempt.outcome?.kind !== "account-deleted";
  const meta = attempt.reauth ? t(branded ? "rid01.reauthClient" : "rid01.reauthOther") : branded ? null : t("rid01.platform");
  const banner = failure === null ? bannerFor(attempt, client, providers, t, locale) : null;

  return (
    <PublicShell brand="RightOne ID" langSwitch={false} fill maxWidth="var(--container-md)" locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <PageHeader title={t(attempt.reauth ? "rid01.titleAgain" : "rid01.title")} {...(meta !== null ? { meta } : {})} size="public" locale={locale} />
        {branded && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Avatar name="RightOne" kind="org" size="sm" decorative />
            <Text size="sm" tone="secondary">{t("rid.toClient")}</Text>
          </div>
        )}
      </div>
      {banner !== null && (
        <Banner family={banner.family} {...(banner.title !== null ? { title: banner.title } : {})} density="portal" locale={locale}>
          {banner.text}
        </Banner>
      )}
      <ViewState
        view={failure !== null ? "error" : "populated"}
        {...(failure?.traceId ? { traceId: failure.traceId } : {})}
        {...(failure !== null ? { retryable: failure.retryable } : {})}
        errorTitle={t("rid01.errTitle")}
        errorText={t("rid.errText")}
        density="portal"
        locale={locale}
      >
        <Panel as="div" gap="lg" inset={panelInset(frame)} density="portal" locale={locale}>
          {/* display: contents keeps the fields in the panel's own column and spacing. */}
          <form action={signIn} style={{ display: "contents" }}>
            <TextField
              label={t("rid.email")}
              type="email"
              name="Input.Email"
              autoComplete="username"
              placeholder={t("rid.emailPlaceholder")}
              value={attempt.email}
              {...(attempt.emailError !== null ? { error: t(attempt.emailError === "required" ? "rid.emailRequired" : "rid.emailInvalid") } : {})}
              required
              density="portal"
              locale={locale}
            />
            <PasswordField
              label={t("rid.password")}
              name="Input.Password"
              autoComplete="current-password"
              value={attempt.password}
              {...(attempt.passwordError !== null ? { error: t("rid.passwordRequired") } : {})}
              required
              density="portal"
              locale={locale}
            />
            <Checkbox label={t("rid01.remember")} name="Input.RememberMe" checked={attempt.remember} density="portal" locale={locale} />
            <Button
              variant="primary"
              size="md"
              type="submit"
              fullWidth
              loading={view === "submitting"}
              loadingLabel={t("rid01.signingIn")}
              locale={locale}
            >
              {t("rid.signIn")}
            </Button>
          </form>
          {providers.length > 0 && (
            <>
              <Divider />
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {providers.map((provider) => (
                  <form key={provider} action={signInWithProvider.bind(null, provider)}>
                    <Button variant="secondary" size="md" type="submit" fullWidth locale={locale}>
                      {t("rid01.signInWith", { provider })}
                    </Button>
                  </form>
                ))}
              </div>
            </>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--space-2) var(--space-6)" }}>
            <Link href={routes.register()} variant="standalone" size="touch" locale={locale}>
              {t("rid01.register")}
            </Link>
            <div style={{ flexBasis: "100%" }}>
              <Text size="sm" tone="secondary">
              {t("rid01.nextBefore")}{" "}
              <Link href={routes.chooseOrganisation()} locale={locale}>
                {t("rid01.nextOrg")}
              </Link>{" "}
              {t("rid01.nextAfter")}
            </Text>
            </div>
          </div>
        </Panel>
      </ViewState>
    </PublicShell>
  );
}

/** RightOne ID's answer to the attempt, worded as the canvas does; null when the form has nothing to say. */
function bannerFor(attempt: SignInAttempt, client: Client, providers: readonly string[], t: Translate, locale: Locale): BannerSpec | null {
  const outcome = attempt.outcome;
  // A provider named when RightOne ID offers exactly one; otherwise "the provider you chose".
  const one = providers.length === 1 ? (providers[0] ?? null) : null;
  switch (outcome?.kind) {
    case undefined:
      return null;
    case "invalid":
      return { family: "danger", title: null, text: t("rid01.invalid") };
    case "locked": {
      const minutes = Math.round((Date.parse(outcome.lockedUntil) - Date.parse(outcome.answeredAt)) / 60000);
      return {
        family: "attention",
        title: null,
        text: t("rid01.locked", { minutes: R1_FORMAT.formatCount(minutes, locale) ?? "-", time: R1_FORMAT.formatTime(outcome.lockedUntil) ?? "-" }),
      };
    }
    case "suspended":
      return { family: "attention", title: t("rid01.suspendedTitle"), text: t(client === "rightone" ? "rid01.suspendedClient" : "rid01.suspendedPlatform") };
    case "unconfirmed":
      return { family: "attention", title: t("rid01.unconfirmedTitle"), text: t("rid01.unconfirmedText") };
    case "session-expired":
      return { family: "attention", title: t("rid01.expiredTitle"), text: t("rid01.expiredText") };
    case "external-failed":
      return {
        family: "attention",
        title: one !== null ? t("rid01.extFailedOne", { provider: one }) : t("rid01.extFailedAny"),
        text: t("rid01.extFailedText"),
      };
    case "external-unverified":
      return {
        family: "attention",
        title: one !== null ? t("rid01.extUnverifiedOne", { provider: one }) : t("rid01.extUnverifiedAny"),
        text: one !== null ? t("rid01.extUnverifiedTextOne", { provider: one }) : t("rid01.extUnverifiedTextAny"),
      };
    case "account-deleted":
      return { family: "neutral", title: t("rid01.deletedTitle"), text: t("rid01.deletedText") };
  }
}

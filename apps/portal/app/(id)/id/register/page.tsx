import { Banner, Button, Link, PageHeader, Panel, PasswordField, StatusLine, TextField, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { register } from "@/features/identity/actions";
import { clientOf, panelInset } from "@/features/identity/layout";
import { NewPasswordField } from "@/features/identity/NewPasswordField";
import { readForPage } from "@/lib/api/flash";
import { loadRegistrationAttempt, type RegistrationAttempt } from "@/lib/api/identity";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { RID07_VIEWS } from "@/lib/mock/identity";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/rid.en.json";
import vi from "@/messages/screens/rid.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const BLANK: RegistrationAttempt = {
  fullName: "",
  email: "",
  password: "",
  confirm: "",
  nameError: null,
  passwordError: null,
  confirmError: null,
  outcome: null,
};

/**
 * SCR-RID-07 Register, the demonstration's stand-in for RightOne ID's page: create a RightOne ID account.
 * RightOne ID then mails a confirmation link, whose page is SCR-RID-08.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, RID07_VIEWS);
  const client = clientOf(params);
  const inset = panelInset(frame);
  const last = readForPage<RegistrationAttempt>(params);
  const outcome = view !== null && view !== "form" ? await loadRegistrationAttempt(view) : last !== null ? { data: last, failure: null } : null;
  const failure = outcome?.failure ?? null;
  const attempt = outcome?.data ?? BLANK;
  const closed = failure?.code === "REGISTRATION_CLOSED";

  return (
    <PublicShell brand="RightOne ID" langSwitch={false} fill maxWidth="var(--container-md)" locale={locale}>
      <PageHeader title={t("rid07.title")} {...(client === "rightone" ? { meta: t("rid.toClient") } : {})} size="public" locale={locale} />
      {closed ? (
        <Banner
          family="neutral"
          title={t("rid07.closedTitle")}
          action={{ label: t("rid07.toSignIn"), href: routes.signIn(), variant: "primary" }}
          density="portal"
          locale={locale}
        >
          {t("rid07.closedText")}
        </Banner>
      ) : (
        <ViewState
          view={failure !== null ? "error" : "populated"}
          {...(failure?.traceId ? { traceId: failure.traceId } : {})}
          {...(failure !== null ? { retryable: failure.retryable } : {})}
          errorTitle={t("rid07.errTitle")}
          errorText={t("rid.errText")}
          density="portal"
          locale={locale}
        >
          {attempt.outcome === "sent" ? (
            <Panel as="div" gap="lg" inset={inset} density="portal" locale={locale}>
              <StatusLine family="info" text={t("rid07.sent")} detail={t("rid07.sentNext")} cutout="surface" locale={locale} />
              <div style={{ display: "flex" }}>
                <Link href={routes.signIn()} variant="standalone" size="touch" locale={locale}>
                  {t("rid.signIn")}
                </Link>
              </div>
            </Panel>
          ) : (
            <Form attempt={attempt} submitting={view === "submitting"} inset={inset} t={t} locale={locale} />
          )}
        </ViewState>
      )}
    </PublicShell>
  );
}

function Form({
  attempt,
  submitting,
  inset,
  t,
  locale,
}: {
  attempt: RegistrationAttempt;
  submitting: boolean;
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
}) {
  return (
    <form action={register}>
      <Panel as="div" description={t("rid07.sub")} gap="lg" inset={inset} density="portal" locale={locale}>
        <TextField
          label={t("rid07.fullName")}
          name="Input.FullName"
          autoComplete="name"
          value={attempt.fullName}
          {...(attempt.nameError !== null ? { error: t("rid07.nameRequired") } : {})}
          required
          density="portal"
          locale={locale}
        />
        <TextField
          label={t("rid.email")}
          type="email"
          name="Input.Email"
          autoComplete="email"
          placeholder={t("rid.emailPlaceholder")}
          value={attempt.email}
          required
          density="portal"
          locale={locale}
        />
        <NewPasswordField
          label={t("rid.password")}
          name="Input.Password"
          autoComplete="new-password"
          initial={attempt.password}
          ruleTexts={{ length: t("rid07.ruleLength"), cases: t("rid07.ruleCase"), digit: t("rid07.ruleDigit"), symbol: t("rid07.ruleSymbol") }}
          {...(attempt.passwordError !== null ? { error: t("rid07.pwned") } : {})}
          required
          density="portal"
          locale={locale}
        />
        <PasswordField
          label={t("rid07.confirm")}
          name="Input.ConfirmPassword"
          autoComplete="new-password"
          value={attempt.confirm}
          {...(attempt.confirmError !== null ? { error: t("rid07.mismatch") } : {})}
          density="portal"
          locale={locale}
        />
        <Button variant="primary" size="md" type="submit" fullWidth loading={submitting} loadingLabel={t("rid07.registering")} locale={locale}>
          {t("rid07.register")}
        </Button>
        <div style={{ display: "flex" }}>
          <Link href={routes.signIn()} back variant="standalone" size="touch" locale={locale}>
            {t("rid07.haveAccount")}
          </Link>
        </div>
      </Panel>
    </form>
  );
}

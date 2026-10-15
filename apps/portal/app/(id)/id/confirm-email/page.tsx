import { Banner, Button, PageHeader, Panel, StatusLine, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { clientOf, panelInset } from "@/features/identity/layout";
import { confirmEmailLink, loadEmailConfirmation } from "@/lib/api/identity";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { RID08_VIEWS } from "@/lib/mock/identity";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/rid.en.json";
import vi from "@/messages/screens/rid.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-RID-08 Confirm the email, the demonstration's stand-in for the RightOne ID page the confirmation link
 * opens: the account is activated, or the link is refused.
 */
export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the page follows the link the reader opened.
  const view = reviewView(params, RID08_VIEWS);
  const client = clientOf(params);
  const { data, failure } = view !== null ? await loadEmailConfirmation(view) : confirmEmailLink(typeof params.token === "string" ? params.token : null);
  const confirmation = data?.outcome ?? null;

  return (
    <PublicShell brand="RightOne ID" langSwitch={false} fill maxWidth="var(--container-md)" locale={locale}>
      <PageHeader title={t("rid08.title")} {...(client === "rightone" ? { meta: t("rid.toClient") } : {})} size="public" locale={locale} />
      <ViewState
        view={failure !== null ? "error" : "populated"}
        {...(failure?.traceId ? { traceId: failure.traceId } : {})}
        {...(failure !== null ? { retryable: failure.retryable } : {})}
        errorTitle={t("rid08.errTitle")}
        errorText={t("rid.errText")}
        density="portal"
        locale={locale}
      >
        {confirmation === "confirmed" && (
          <Panel as="div" gap="lg" inset={panelInset(frame)} density="portal" locale={locale}>
            <StatusLine family="positive" text={t("rid08.confirmed")} detail={t("rid08.confirmedNext")} cutout="surface" locale={locale} />
            <Button variant="primary" size="md" href={routes.signIn()} fullWidth locale={locale}>
              {t("rid.signIn")}
            </Button>
          </Panel>
        )}
        {confirmation === "failed" && (
          <Banner family="attention" density="portal" locale={locale}>
            {t("rid08.failed")}
          </Banner>
        )}
        {confirmation === "bad-link" && (
          <Banner family="danger" density="portal" locale={locale}>
            {t("rid08.badLink")}
          </Banner>
        )}
      </ViewState>
    </PublicShell>
  );
}

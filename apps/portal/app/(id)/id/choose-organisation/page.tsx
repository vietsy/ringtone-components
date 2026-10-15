import { redirect } from "next/navigation";
import { PageHeader, Panel, Skeleton, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { clientOf, panelInset } from "@/features/identity/layout";
import { OrganisationPicker } from "@/features/identity/OrganisationPicker";
import { loadOrganisationChoice, loadSessionOrganisations } from "@/lib/api/identity";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { RID04_VIEWS } from "@/lib/mock/identity";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/rid.en.json";
import vi from "@/messages/screens/rid.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-RID-04 Choose an organisation, the demonstration's stand-in for RightOne ID's page. An account in more
 * than one organisation chooses the one it signs in for; RightOne then opens in that organisation.
 */
export default async function ChooseOrganisationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, RID04_VIEWS);
  const client = clientOf(params);
  const inset = panelInset(frame);
  // A reviewer's ?view= shows a drawn state; otherwise the signed-in account's organisations, and how its last
  // choice was answered. Nobody signed in has nothing to choose, so the page sends them to sign in.
  const submitted = typeof params.submitted === "string" ? params.submitted : null;
  const outcome = view === "loading" ? null : view !== null ? await loadOrganisationChoice(view) : await loadSessionOrganisations(submitted);
  if (view === null && outcome === null) redirect(routes.signIn());
  const failure = outcome?.failure ?? null;
  const choice = outcome?.data ?? null;
  const empty = choice !== null && choice.organisations.length === 0;
  const toRightOne = client === "rightone";

  return (
    <PublicShell brand="RightOne ID" langSwitch={false} fill maxWidth="var(--container-md)" locale={locale}>
      <PageHeader title={t("rid04.title")} {...(toRightOne ? { meta: t("rid.toClient") } : {})} size="public" locale={locale} />
      <ViewState
        view={failure !== null ? "error" : empty ? "empty" : "populated"}
        {...(failure?.traceId ? { traceId: failure.traceId } : {})}
        {...(failure !== null ? { retryable: failure.retryable } : {})}
        errorTitle={t("rid04.errTitle")}
        errorText={t("rid.errText")}
        empty={{ variant: "not-started", title: t("rid04.emptyTitle"), text: t("rid04.emptyText"), icon: "building-2", action: false }}
        density="portal"
        locale={locale}
      >
        <Panel as="div" description={t("rid04.sub")} gap="lg" inset={inset} density="portal" locale={locale}>
          {choice === null ? (
            <>
              <Skeleton variant="card" rows={1} density="portal" locale={locale} />
              <Skeleton variant="card" rows={1} density="portal" locale={locale} />
            </>
          ) : (
            <>
              <OrganisationPicker
                legend={t("rid04.legend")}
                options={choice.organisations.map((org) => ({ value: org.id, label: org.name, helper: org.slug }))}
                initial={choice.submitted}
                error={choice.refused ? t("rid04.invalid") : null}
                label={t(toRightOne ? "rid04.goClient" : "rid04.go")}
                workingLabel={t(toRightOne ? "rid04.goingClient" : "rid04.going")}
                working={view === "working"}
                pickFirst={t("rid04.pickFirst")}
                locale={locale}
              />
              <Text size="sm" tone="secondary">{t("rid04.next")}</Text>
            </>
          )}
        </Panel>
      </ViewState>
    </PublicShell>
  );
}

import { Banner, Button, ButtonRow, FactList, PageHeader, Panel, Skeleton, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { PublicShell } from "@/components/shells/PublicShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { comTranslator, day, elementsOf, readerOf } from "@/features/notices/copy";
import { loadNotice, type NoticeView } from "@/lib/api/notices";
import { currentPrincipal, currentWorld } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { COM10_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;
type Failure = { code: string; traceId: string | null; retryable: boolean };

/**
 * SCR-COM-10 My notice. Anyone holding the reference may read it and nothing here requires an account; a
 * principal reads their party's notice inside their portal, and one addressed to another party is refused
 * ROLE_OUT_OF_SCOPE. The six elements read in a person's order, not the record's, in the words of the template
 * version the notice was composed from; a reissue names the notice it replaces and why.
 */
export default async function NoticePage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }) {
  // No guard turns a reader away: the reference opens the notice.
  const principal = await currentPrincipal();
  const [{ reference: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = comTranslator(locale);
  const view = reviewView(query, COM10_VIEWS);
  const key = principal?.sessionId ?? (await currentWorld());
  const outcome = view === "loading" ? null : await loadNotice(key, reference, readerOf(principal), view);
  const notice = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0, maxWidth: phone ? "100%" : "var(--container-3xl)" }}>
      <PageHeader
        {...(principal !== null ? { crumbs: [{ label: t("comMine.crumb"), href: routes.myNotices() }] } : { size: "public" as const })}
        title={t("com10.title", { ref: reference })}
        {...(notice !== null && notice.issuedAt !== null ? { meta: t("com10.sent", { d: day(notice.issuedAt, locale) }) } : {})}
        {...(notice !== null ? { status: { family: STATE_FAMILY[notice.state] ?? "info", label: t(`com10.state.${notice.state}`) } } : {})}
        locale={locale}
      />
      {view === "loading" ? (
        <Panel inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={5} density="portal" locale={locale} />
        </Panel>
      ) : null}
      {failure !== null ? <Failed failure={failure} t={t} locale={locale} /> : null}
      {notice !== null ? <Notice notice={notice} phone={phone} t={t} locale={locale} /> : null}
    </div>
  );

  if (principal === null) {
    return (
      <PublicShell fill locale={locale}>
        {body}
      </PublicShell>
    );
  }
  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={premisesNav("notices", frame, locale)} account={principal.account} locale={locale}>
      {body}
    </PortalShell>
  );
}

function Failed({ failure, t, locale }: { failure: Failure; t: Translate; locale: Locale }) {
  if (failure.code === "NOTICE_NOT_FOUND" || failure.code === "ROLE_OUT_OF_SCOPE") {
    return (
      <ViewState
        level={2}
        view="refused"
        refusal={{
          code: failure.code,
          title: t(`com.refusal.${failure.code}.title`),
          text: t(`com.refusal.${failure.code}.text`),
          family: "attention",
          ...(failure.code === "ROLE_OUT_OF_SCOPE" ? { action: { label: t("comMine.backList"), href: routes.myNotices() } } : {}),
        }}
        density="portal"
        locale={locale}
      />
    );
  }
  return (
    <ViewState
      level={2}
      view="error"
      errorTitle={t("com10.errTitle")}
      errorText={t("com10.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      density="portal"
      locale={locale}
    />
  );
}

/** How a recipient reads the state of what they were sent: what did not reach them is attention, never alarm. */
const STATE_FAMILY: Partial<Record<NoticeView["state"], "positive" | "attention" | "neutral" | "info">> = {
  ISSUED: "info",
  DELIVERED: "positive",
  UNDELIVERED: "attention",
  SERVED_ALTERNATIVELY: "positive",
  SUPERSEDED: "neutral",
};

/**
 * What happened to the notice on its way, in the recipient's words: an address it did not reach, a service by
 * another route with its route and date, a letter still with the post. A delivered notice needs no sentence.
 */
function Delivery({ notice, t, locale }: { notice: NoticeView; t: Translate; locale: Locale }) {
  const { delivery } = notice;
  if (notice.state === "UNDELIVERED") {
    return (
      <Banner family="attention" title={t("com10.undeliveredTitle", { destination: delivery.destination ?? "" })} density="portal" locale={locale}>
        {t("com10.undeliveredText")}
      </Banner>
    );
  }
  if (notice.state === "SERVED_ALTERNATIVELY" && delivery.service !== null) {
    return (
      <Banner family="info" title={t("com10.servedTitle")} density="portal" locale={locale}>
        {t("com10.servedText", { route: delivery.service.route, d: day(delivery.service.servedOn, locale) })}
      </Banner>
    );
  }
  if (notice.state === "ISSUED" && delivery.channel === "post" && notice.issuedAt !== null) {
    return (
      <Banner family="info" title={t("com10.postTitle")} density="portal" locale={locale}>
        {t("com10.postText", { d: day(notice.issuedAt, locale) })}
      </Banner>
    );
  }
  return null;
}

function Notice({ notice, phone, t, locale }: { notice: NoticeView; phone: boolean; t: Translate; locale: Locale }) {
  const content = notice.content;
  const elements = content !== null ? elementsOf(content, t, locale) : null;
  return (
    <>
      <Delivery notice={notice} t={t} locale={locale} />
      {notice.supersededBy !== null ? (
        <Banner
          family="info"
          title={t("com10.supTitle")}
          action={{ label: t("com10.openCurrent", { ref: notice.supersededBy.reference }), href: routes.myNotice(notice.supersededBy.reference), variant: "secondary" }}
          density="portal"
          locale={locale}
        >
          {t("com10.supText", { d: day(notice.supersededBy.on, locale), ref: notice.supersededBy.reference })}
        </Banner>
      ) : null}
      {notice.replaces !== null ? (
        <Banner family="info" title={t("com10.replacesTitle", { ref: notice.replaces.reference })} density="portal" locale={locale}>
          {t("com10.replacesText", { reason: notice.replaces.reason })}
        </Banner>
      ) : null}
      {content !== null && elements !== null ? (
        <Panel inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("com10.about"), value: elements.subject },
              { label: t("com10.todo"), value: elements.action },
              { label: t("com10.by"), value: content.deadline, kind: "date", ...(notice.remainingDays !== null ? { note: t("com10.remaining", { n: notice.remainingDays }) } : {}) },
              { label: t("com10.ifNot"), value: elements.consequence },
              { label: t("com10.contact"), value: elements.contact },
            ]}
            density="portal"
            locale={locale}
          />
        </Panel>
      ) : null}
      {/* Nothing on this page offers to create an account. The delivery record (SCR-COM-11) is not built yet. */}
      <ButtonRow>
        <Button variant="secondary" size="md" href={routes.noticePreferences(notice.reference)} fullWidth={phone} locale={locale}>
          {t("com.change")}
        </Button>
      </ButtonRow>
    </>
  );
}

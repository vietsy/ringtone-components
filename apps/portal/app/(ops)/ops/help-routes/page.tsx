import { Banner, Button, ButtonRow, Checkbox, ChoiceList, FilterBar, PageHeader, Select, SidePanel, Skeleton, TextField, Toast, ViewState, type StatusValue } from "@/components/r1";
import { consoleArea } from "@/components/shells/ops-nav";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { confirmRouteAct, retireRouteAct, saveRouteAct } from "@/features/public/console-actions";
import { day, pubTranslator, refusalWords, shortDay, type PolicyAttempt } from "@/features/public/console";
import { RouteRegisterTable, type RouteActs } from "@/features/public/RouteRegisterTable";
import { readForPage } from "@/lib/api/flash";
import { loadHelpRouteRegister, type HelpPurpose, type HelpRouteRegister, type PolicyRefusal, type RegisterRoute } from "@/lib/api/public";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { POLICY_VIEWS } from "@/lib/mock/public";
import type { HelpJourney } from "@/lib/route-groups/public-pages";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const PURPOSES: readonly HelpPurpose[] = ["complaint", "support", "correction", "privacy_information", "privacy_rights", "external_escalation", "player_guide", "authoritative"];
const JOURNEYS: readonly HelpJourney[] = ["about", "scope", "tariff", "verify", "complain", "privacy", "player", "legal"];
const KINDS = ["URL", "PHONE", "EMAIL", "POSTAL"] as const;
const STATES: readonly RegisterRoute["state"][] = ["active", "unconfirmed", "retired"];
const STATE_FAMILY: Readonly<Record<RegisterRoute["state"], StatusValue["family"]>> = { active: "positive", unconfirmed: "attention", retired: "neutral" };

const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-PUB-18 Help route register, on the operations console as its board's bar names it: every help, complaint,
 * privacy and contact route the public pages show, unconfirmed first, with when each was last confirmed. The officer
 * confirms a route, edits it (which confirms it too), retires it with a reason, or adds one; what changes is on the
 * public Help page (SCR-PUB-12) at once. The nightly check is applied as the register is read: a route past its
 * 90 days is unconfirmed, and the public pages show the authoritative contact in its place until someone confirms it.
 */
export default async function HelpRouteRegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const params = await searchParams;
  const locale = await getLocale();
  const t = pubTranslator(locale);
  const view = reviewView(params, POLICY_VIEWS);
  // A cursor the address carries is sent as it is: the register issues none, so any is refused (CURSOR_INVALID).
  const cursor = one(params.cursor);
  const filter = {
    state: STATES.find((state) => state === one(params.state)) ?? null,
    purpose: PURPOSES.find((purpose) => purpose === one(params.purpose)) ?? null,
    cursor,
  };
  const kept = readForPage<PolicyAttempt>(params);
  const attempt = kept !== null && kept.on === "routes" ? kept : null;
  const outcome = view === "loading" ? null : await loadHelpRouteRegister(staff, filter, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const editing = one(params.edit);
  const adding = one(params.new) !== null;
  const refusal = attempt?.refusal ?? null;

  return (
    <OpsFrame
      console="operations"
      current="helpRoutes"
      staff={staff}
      searchLabel={t("pub18.search")}
      keyMap={(data?.routes.length ?? 0) > 0 ? [{ keys: ["J", "K"], label: t("pubc.kRows") }, { keys: ["Enter"], label: t("pubc.kOpen") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: consoleArea("operations", locale) }]}
          title={t("pub18.title")}
          {...(data !== null ? { meta: t("pub18.meta", { n: data.counts.all, a: data.counts.active, u: data.counts.unconfirmed, r: data.counts.retired }) } : {})}
          locale={locale}
        >
          {failure === null ? (
            <Button variant="primary" size="sm" icon="plus" href={routes.opsHelpRoutes({ ...filter, adding: true })} locale={locale}>
              {t("pub18.newRoute")}
            </Button>
          ) : null}
        </PageHeader>
        {data !== null ? <Outcome attempt={attempt} data={data} t={t} locale={locale} /> : null}
        {refusal !== null ? (
          <Banner family="attention" title={refusalWords(refusal, t).title} code={refusal.code} live density="console" locale={locale}>
            {refusalWords(refusal, t).text}
          </Banner>
        ) : null}
        {failure?.code === "NOT_AUTHORISED" ? (
          <ViewState
            view="refused"
            refusal={{ code: failure.code, title: refusalWords(failure, t).title, text: refusalWords(failure, t).text ?? "", family: "attention" }}
            level={2}
            density="console"
            locale={locale}
          />
        ) : failure !== null && failure.code !== "CURSOR_INVALID" ? (
          <ViewState view="error" errorTitle={t("pubc.errTitle")} errorText={t("pubc.errText")} {...(failure.traceId !== null ? { traceId: failure.traceId } : {})} retryable={failure.retryable} level={2} density="console" locale={locale} />
        ) : (
          <Register data={data} chosen={filter} cursorRefused={failure?.code === "CURSOR_INVALID"} t={t} locale={locale} />
        )}
      </div>
      {data !== null && (adding || editing !== null) ? (
        <RouteForm route={editing !== null ? (data.routes.find((route) => route.id === editing) ?? null) : null} adding={editing === null} attempt={attempt} t={t} locale={locale} />
      ) : null}
    </OpsFrame>
  );
}

/** What the act just done did: a toast naming the route; a refusal is in the header instead. */
function Outcome({ attempt, data, t, locale }: { attempt: PolicyAttempt | null; data: HelpRouteRegister; t: Translate; locale: Locale }) {
  if (attempt === null || attempt.refusal !== null) return null;
  const route = data.routes.find((candidate) => candidate.id === attempt.values.route);
  if (route === undefined) return null;
  const names = { purpose: t(`pub18.purposeIn.${route.purpose}`), destination: route.destination };
  const toast =
    attempt.act === "confirm"
      ? { title: t("pub18.confirmedTitle", names), text: t("pub18.confirmedText", { date: day(route.confirmedAt, locale) }) }
      : attempt.act === "save"
        ? { title: t("pub18.savedTitle", names), text: t("pub18.savedText") }
        : attempt.act === "add"
          ? { title: t("pub18.addedTitle", names), text: t("pub18.addedText") }
          : attempt.act === "retire"
            ? { title: t("pub18.retiredTitle", names), text: t("pub18.retiredText") }
            : null;
  if (toast === null) return null;
  return (
    <div style={{ maxWidth: "var(--container-lg)" }}>
      <Toast family={attempt.act === "retire" ? "neutral" : "positive"} title={toast.title} locale={locale}>
        {toast.text}
      </Toast>
    </div>
  );
}

const responsibleWords = (route: RegisterRoute, t: Translate): string => (typeof route.responsible === "string" ? t(`pub.responsible.${route.responsible}`) : route.responsible.name);

function Register({
  data,
  chosen,
  cursorRefused,
  t,
  locale,
}: {
  data: HelpRouteRegister | null;
  chosen: Readonly<{ state: RegisterRoute["state"] | null; purpose: HelpPurpose | null }>;
  cursorRefused: boolean;
  t: Translate;
  locale: Locale;
}) {
  const routesShown = data?.routes ?? [];
  const lastAuthoritative = refusalWords({ code: "LAST_AUTHORITATIVE_CONTACT" }, t);
  const acts: Record<string, RouteActs> = Object.fromEntries(
    routesShown.map((route) => {
      const purposeIn = t(`pub18.purposeIn.${route.purpose}`);
      const live = route.state !== "retired";
      return [
        route.id,
        {
          name: `${t(`pub18.purpose.${route.purpose}`)} ${route.destination}`,
          confirm: live,
          editHref: live ? routes.opsHelpRoutes({ ...chosen, edit: route.id }) : null,
          retire: live
            ? {
                disabledReason: route.lastAuthoritative ? `${lastAuthoritative.title} ${lastAuthoritative.text ?? ""}`.trim() : null,
                title: t("pub18.dlgTitle", { purpose: purposeIn, destination: route.destination }),
                description: t("pub18.dlgText", { purpose: purposeIn }),
                confirm: t("pub18.dlgYes", { purpose: purposeIn }),
              }
            : null,
        } satisfies RouteActs,
      ];
    }),
  );
  return (
    <>
      <form action={routes.opsHelpRoutes()}>
        <FilterBar
          label={t("pub18.filterLabel")}
          shortcut="/"
          {...(data !== null ? { summary: routesShown.length === 1 ? t("pub18.summaryOne") : t("pub18.summary", { n: routesShown.length }) } : {})}
          active={chosen.state !== null || chosen.purpose !== null}
          locale={locale}
        >
          <Select
            label={t("pub18.fStatus")}
            name="state"
            options={[{ value: "", label: t("pub18.all") }, ...STATES.map((state) => ({ value: state, label: t(`pub18.state.${state}`) }))]}
            value={chosen.state ?? ""}
            width="var(--space-48)"
            density="console"
            locale={locale}
          />
          <Select
            label={t("pub18.fPurpose")}
            name="purpose"
            options={[{ value: "", label: t("pub18.all") }, ...PURPOSES.map((purpose) => ({ value: purpose, label: t(`pub18.purpose.${purpose}`) }))]}
            value={chosen.purpose ?? ""}
            width="var(--space-56)"
            density="console"
            locale={locale}
          />
          <Button variant="secondary" size="sm" type="submit" locale={locale}>
            {t("pub18.show")}
          </Button>
        </FilterBar>
      </form>
      {cursorRefused ? (
        <Banner
          family="attention"
          title={t("pubc.refusal.CURSOR_INVALID.title")}
          code="CURSOR_INVALID"
          action={{ label: t("pubc.reloadStart"), href: routes.opsHelpRoutes(chosen), icon: "refresh-cw", variant: "secondary" }}
          density="console"
          locale={locale}
        >
          {t("pubc.refusal.CURSOR_INVALID.text")}
        </Banner>
      ) : null}
      {data === null && !cursorRefused ? (
        <Skeleton variant="table" rows={7} columns={6} density="console" locale={locale} />
      ) : (
        <RouteRegisterTable
          columns={[
            { key: "route", label: t("pub18.cRoute"), kind: "stack", minWidth: "var(--space-48)" },
            { key: "dest", label: t("pub18.cDest"), kind: "stack" },
            { key: "resp", label: t("pub18.cResp") },
            { key: "confirmed", label: t("pub18.cConfirmed"), kind: "date", short: true },
            { key: "state", label: t("pub18.cState"), kind: "status" },
            { key: "act", label: t("pub18.cAct"), kind: "actions" },
          ]}
          rows={routesShown.map((route) => routeRow(route, data?.confirmationDays ?? 0, t, locale))}
          acts={acts}
          confirmAction={confirmRouteAct}
          retireAction={retireRouteAct}
          words={{ confirm: t("pub18.confirmA"), edit: t("pub18.editA"), retire: t("pub18.retireA"), reason: t("pub18.reason"), cancel: t("pubc.cancel"), clear: t("pub18.clear") }}
          table={{
            caption: t("pub18.title"),
            sortNote: t("pub18.sortNote"),
            empty: { title: t("pub18.empty"), clearHref: chosen.state !== null || chosen.purpose !== null ? routes.opsHelpRoutes() : null },
          }}
          locale={locale}
        />
      )}
    </>
  );
}

function routeRow(route: RegisterRoute, days: number, t: Translate, locale: Locale): Record<string, unknown> {
  const detail =
    route.state === "unconfirmed"
      ? route.unconfirmedReason === "CHECK_FAILED"
        ? t("pub18.checkFailed")
        : t("pub18.expired", { days })
      : route.state === "retired" && route.retiredAt !== null
        ? t("pub18.retiredOn", { date: shortDay(route.retiredAt, locale) })
        : null;
  return {
    _key: route.id,
    ...(route.state === "unconfirmed" ? { _tone: "attention" } : {}),
    route: { text: t(`pub18.purpose.${route.purpose}`), detail: route.journeys.map((journey) => t(`pub18.journey.${journey}`)).join(", ") },
    dest: { text: route.destination, detail: route.publicAccess ? t(`pub18.kind.${route.destinationKind}`) : `${t(`pub18.kind.${route.destinationKind}`)}, ${t("pub18.signIn")}`, mono: true },
    resp: responsibleWords(route, t),
    confirmed: route.confirmedAt,
    state: { family: STATE_FAMILY[route.state], label: t(`pub18.state.${route.state}`), ...(detail !== null ? { detail } : {}) },
  };
}

/**
 * The route's form beside the register: a new route's purpose, and for every route the pages it shows on, its
 * destination in the form its kind requires, who answers it and whether it opens without a sign-in. A refusal comes
 * back with what was typed and the field it concerns marked.
 */
function RouteForm({ route, adding, attempt, t, locale }: { route: RegisterRoute | null; adding: boolean; attempt: PolicyAttempt | null; t: Translate; locale: Locale }) {
  if (!adding && route === null) return null;
  const refused: PolicyRefusal | null = attempt?.refusal ?? null;
  const typed = refused !== null ? attempt?.typed ?? {} : {};
  const text = (name: string, fallback: string) => {
    const value = typed[name];
    return typeof value === "string" ? value : fallback;
  };
  const kind = text("destination_kind", route?.destinationKind ?? "URL");
  const journeysTyped = typed.journeys;
  const journeys: string[] = typeof journeysTyped === "object" ? [...journeysTyped] : [...(route?.journeys ?? [])];
  const fix = (name: string): string | null => {
    if (refused?.code !== "DESTINATION_INVALID" || refused.field !== name) return null;
    return name === "destination" ? t(`pub18.fix.${refused.values.kind ?? kind}`) : t(`pub18.fix.${name}`);
  };
  const destinationError = fix("destination");
  const responsibleError = fix("responsible_destination");
  const journeysError = fix("journeys");
  const purposeError = fix("route_kind");
  const kindError = fix("destination_kind");
  const destination = route === null ? "" : route.destinationKind === "URL" ? `https://${route.destination}` : route.destination;
  return (
    <SidePanel
      title={route === null ? t("pub18.newTitle") : t("pub18.editTitle", { purpose: t(`pub18.purposeIn.${route.purpose}`) })}
      eyebrow={route?.id ?? t("pub18.eyebrow")}
      {...(route !== null ? { status: { family: STATE_FAMILY[route.state], label: t(`pub18.state.${route.state}`) } } : {})}
      open
      density="console"
      locale={locale}
    >
      <form action={saveRouteAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <input type="hidden" name="route" value={route?.id ?? ""} />
        {route === null ? (
          <Select
            label={t("pub18.fKind")}
            name="route_kind"
            options={PURPOSES.map((purpose) => ({ value: purpose, label: t(`pub18.purpose.${purpose}`) }))}
            value={text("route_kind", "complaint")}
            required
            {...(purposeError !== null ? { error: purposeError } : {})}
            density="console"
            locale={locale}
          />
        ) : null}
        <ChoiceList
          legend={t("pub18.fJourneys")}
          helper={t("pub18.journeysHelp")}
          name="journeys"
          options={JOURNEYS.map((journey) => ({ value: journey, label: t(`pub18.journey.${journey}`) }))}
          value={journeys}
          multiple
          layout="chips"
          required
          {...(journeysError !== null ? { error: journeysError } : {})}
          density="console"
          locale={locale}
        />
        <Select
          label={t("pub18.fDestKind")}
          name="destination_kind"
          options={KINDS.map((option) => ({ value: option, label: t(`pub18.kind.${option}`) }))}
          value={kind}
          required
          {...(kindError !== null ? { error: kindError } : {})}
          density="console"
          locale={locale}
        />
        <TextField
          label={t("pub18.fDest")}
          name="destination"
          helper={t("pub18.destHelp")}
          value={text("destination", destination)}
          mono
          required
          {...(destinationError !== null ? { error: destinationError } : {})}
          density="console"
          locale={locale}
        />
        <TextField
          label={t("pub18.fResp")}
          name="responsible_destination"
          helper={t("pub18.respHelp")}
          value={text("responsible_destination", route !== null ? responsibleWords(route, t) : "")}
          required
          {...(responsibleError !== null ? { error: responsibleError } : {})}
          density="console"
          locale={locale}
        />
        <Checkbox label={t("pub18.fPublic")} name="public_access" checked={typed.public_access !== undefined ? typed.public_access === "on" : (route?.publicAccess ?? true)} density="console" locale={locale} />
        <ButtonRow>
          <Button variant="primary" size="sm" type="submit" locale={locale}>
            {route === null ? t("pub18.add") : t("pub18.save")}
          </Button>
          <Button variant="quiet" size="sm" href={routes.opsHelpRoutes()} locale={locale}>
            {t("pubc.cancel")}
          </Button>
        </ButtonRow>
      </form>
    </SidePanel>
  );
}

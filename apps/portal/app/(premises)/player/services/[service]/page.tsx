import {
  Button,
  Columns,
  Divider,
  FactList,
  Link,
  NavList,
  NumberedSteps,
  PageHeader,
  Panel,
  Timeline,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { day, moment, serviceStatus, venTranslator } from "@/features/venue/copy";
import { LoadError, RefusedBody, VenueShell } from "@/features/venue/Frame";
import { requirePrincipal } from "@/lib/api/session";
import { loadService, TERMINAL, type HistoryRow, type ServiceRecord } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN04_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import type { ReactNode } from "react";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VEN-04 Service detail and history, the hub of the service: its state and why, everything that happened to it
 * and when, and every screen the premises works on it from. The cause panel is never empty: it changes with the
 * state, and an ending waiting to take effect is said with its date.
 */
export default async function ServicePage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN04_VIEWS);
  const outcome = view === "loading" ? null : await loadService(principal, service, view);
  const record = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const refused = failure !== null && (failure.code === "ENTITLEMENT_NOT_FOUND" || failure.code === "NOT_AUTHORISED_FOR_PREMISES");
  const phone = frame === "phone";

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={record !== null ? { premises: record.premises.name, period: record.code } : null}>
      <PageHeader
        crumbs={[{ label: t("ven.crumb"), href: routes.player() }]}
        title={record !== null ? record.premises.name : t("ven04.title")}
        {...(record !== null ? { status: serviceStatus(record.status, t), meta: meta(record, t, locale) } : {})}
        locale={locale}
      >
        {record?.status === "PENDING_TERMS" ? (
          <Button variant="primary" size="md" href={routes.playerTerms(record.code)} fullWidth={phone} locale={locale}>
            {t("ven04.accept")}
          </Button>
        ) : null}
      </PageHeader>
      {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={8} density="portal" locale={locale} /> : null}
      {failure !== null && refused ? <RefusedBody code={failure.code} back={{ label: t("ven.backServices"), href: routes.player() }} t={t} locale={locale} /> : null}
      {failure !== null && !refused ? <LoadError failure={failure} locale={locale} /> : null}
      {record !== null ? <Service record={record} frame={frame} t={t} locale={locale} /> : null}
    </VenueShell>
  );
}

/** "Mã dịch vụ RPS-…. Tạm ngừng từ 26 thg 9, 2026, 18:00 (GMT+7), giờ Việt Nam." */
function meta(record: ServiceRecord, t: Translate, locale: Locale): string {
  if (record.status === "PENDING_TERMS") return t("ven04.metaPending", { code: record.code, ts: moment(record.enrolledAt, locale) });
  const key = TERMINAL.includes(record.status) ? `ven04.metaAt.${record.status}` : `ven04.metaSince.${record.status}`;
  return t(key, { code: record.code, ts: moment(record.since, locale) });
}

function Service({ record, frame, t, locale }: { record: ServiceRecord; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const ended = TERMINAL.includes(record.status) || (record.ending !== null && !record.ending.applied);
  const pending = record.status === "PENDING_TERMS";
  const links = [
    { label: t("ven04.playlists"), detail: t("ven04.playlistsDetail"), icon: "list-music", href: routes.playerPlaylists(record.code) },
    { label: t("ven04.schedule"), detail: t("ven04.scheduleDetail"), icon: "calendar", href: routes.playerSchedule(record.code) },
    { label: t("ven04.fallbacks"), detail: t("ven04.fallbacksDetail"), icon: "history", href: routes.playerFallbacks(record.code) },
    { label: t("ven04.view"), detail: t("ven04.viewDetail"), icon: "layout-dashboard", href: routes.playerServiceView(record.code) },
    pending
      ? { label: t("ven04.doc"), icon: "file-check", disabled: true, reason: t("ven.refusal.ENTITLEMENT_PENDING") }
      : { label: t("ven04.doc"), detail: t("ven04.docDetail"), icon: "file-check", href: routes.playerDocument(record.code) },
  ];
  return (
    <Columns single={phone}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Cause record={record} inset={inset} t={t} locale={locale} />
        <Text size="base">{t("ven.line")}</Text>
        <Panel title={t("ven04.history")} level={2} inset={inset} density="portal" locale={locale}>
          <Timeline entries={record.history.map((row, index) => entry(row, index, t, locale))} locale={locale} />
        </Panel>
      </div>
      <Panel as="aside" variant="plain" gap="lg" locale={locale}>
        <Panel inset={inset} density="portal" locale={locale}>
          <NavList title={t("ven04.goTitle")} items={links} locale={locale} />
        </Panel>
        <Panel inset={inset} density="portal" locale={locale}>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            {...(ended ? { disabled: true, disabledReason: t("ven.refusal.ALREADY_ENDED") } : { href: routes.playerEnd(record.code) })}
            locale={locale}
          >
            {t("ven04.end")}
          </Button>
        </Panel>
        <Link back href={routes.player()} variant="standalone" size="touch" locale={locale}>
          {t("ven.backServices")}
        </Link>
      </Panel>
    </Columns>
  );
}

/** The panel that says why the service is in its state, which is never empty (SCR-VEN-04, conditional display). */
function Cause({ record, inset, t, locale }: { record: ServiceRecord; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const status = serviceStatus(record.status, t);
  const panel = (title: string, family: "neutral" | "attention" | "danger" | "info", body: ReactNode) => (
    <Panel title={title} level={2} family={family} familyLabel={status.label} inset={inset} density="portal" locale={locale}>
      {body}
    </Panel>
  );
  const ending = record.ending;
  if (record.enforcement !== null && (record.status === "SUSPENDED" || record.status === "RESTRICTED" || record.status === "REVOKED")) {
    const enforcement = record.enforcement;
    return panel(
      t(`ven04.why.${record.status}`),
      record.status === "RESTRICTED" ? "attention" : "danger",
      <>
        <FactList
          items={[
            { label: t("ven04.ground"), value: enforcement.ground[locale] },
            { label: t("ven04.under"), value: enforcement.policy[locale] },
            { label: t("ven04.took"), value: enforcement.effectiveAt, kind: "datetime" },
            ...(enforcement.remedy !== null ? [{ label: t("ven04.remedy"), value: enforcement.remedy[locale] }] : []),
          ]}
          locale={locale}
        />
        {record.status !== "REVOKED" && enforcement.conditions.length > 0 ? (
          <NumberedSteps title={t("ven04.condTitle")} level={3} steps={enforcement.conditions.map((condition) => condition[locale])} locale={locale} />
        ) : null}
        <Divider />
        <Text size="base" weight="medium">
          {t(`ven04.effect.${record.status}`)}
        </Text>
      </>,
    );
  }
  if (ending !== null && ending.cause === "SCOPE_EXIT" && ending.scopeExit !== null) {
    return panel(
      t("ven04.scopeTitle"),
      "info",
      <>
        <Text size="base">{t(`ven04.scopeText.${ending.scopeExit.family}`)}</Text>
        <FactList
          items={[
            { label: t("ven04.cause"), value: t(`ven04.scopeCause.${ending.scopeExit.family}`) },
            { label: t("ven04.reference"), value: ending.scopeExit.reference, kind: "mono" },
            { label: t("ven04.took"), value: ending.effectiveAt, kind: "datetime" },
          ]}
          locale={locale}
        />
      </>,
    );
  }
  if (ending !== null && ending.cause === "PREMISES_REQUEST") {
    const requested = [
      ...(ending.requestedBy !== null ? [{ label: t("ven04.reqBy"), value: ending.requestedBy }] : []),
      ...(ending.requestedAt !== null ? [{ label: t("ven04.reqAt"), value: ending.requestedAt, kind: "datetime" as const }] : []),
    ];
    return ending.applied
      ? panel(t("ven04.endedTitle"), "info", <FactList items={[...requested, { label: t("ven04.took"), value: ending.effectiveAt, kind: "datetime" }]} locale={locale} />)
      : panel(
          t("ven04.endingTitle"),
          "info",
          <>
            <Text size="base">{t("ven04.endingText", { d: day(ending.effectiveAt, locale) })}</Text>
            <FactList items={requested} locale={locale} />
          </>,
        );
  }
  if (record.status === "PENDING_TERMS") return panel(t("ven04.pendingTitle"), "attention", <Text size="base">{t("ven04.pendingText")}</Text>);
  return panel(
    t("ven04.termsTitle"),
    "neutral",
    record.terms !== null ? (
      <>
        <Text size="base">{t("ven04.termsText", { n: record.terms.version, d: day(record.terms.acceptedAt, locale), name: record.terms.acceptedBy })}</Text>
        {/* PUB's page as at the day of acceptance shows the version accepted. */}
        <Link href={routes.legalDocument("premises-service-terms", { at: record.terms.acceptedOn })} icon="file-text" locale={locale}>
          {t("ven04.termsLink", { n: record.terms.version })}
        </Link>
      </>
    ) : null,
  );
}

/** One history row: the change in state words, who recorded it, and what it rests on. */
function entry(row: HistoryRow, index: number, t: Translate, locale: Locale) {
  const word = (status: HistoryRow["to"]) => t(`ven.status.${status}`);
  const title =
    row.cause === "ENROLMENT"
      ? t("ven04.hEnrolled")
      : row.cause === "ENDING_REQUESTED"
        ? t("ven04.hEnding", { d: day(`${row.endingFrom ?? ""}T00:00:00+07:00`, locale) })
        : t("ven04.hChange", { from: row.from !== null ? word(row.from) : "", to: word(row.to) });
  const actor =
    row.recordedBy.kind === "SYSTEM"
      ? t("ven04.hSystem")
      : row.recordedBy.operations
        ? t("ven04.hOperations", { name: row.recordedBy.name })
        : row.recordedBy.name;
  const detail =
    row.cause === "TERMS_ACCEPTED" && row.termsVersion !== null
      ? t("ven04.hTerms", { n: row.termsVersion })
      : row.cause === "ENFORCEMENT"
        ? t("ven04.hEnforcement")
        : row.cause === "REINSTATEMENT"
          ? t("ven04.hReinstatement")
          : row.cause === "SCOPE_EXIT"
            ? t("ven04.hScopeExit")
            : null;
  const status = row.cause === "ENDING_REQUESTED" ? { family: "info" as const, label: t("ven04.hEndingStatus") } : serviceStatus(row.to, t);
  return { id: `h${index}`, at: row.at, title, actor, ...(detail !== null ? { detail } : {}), status };
}

import { Banner, FactList, MetricValue, PageHeader, Panel, Toast, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { count, credentialStatus, iamopsTranslator, moment, refusalWords, said } from "@/features/player-ops/copy";
import { CredentialActions } from "@/features/player-ops/CredentialActions";
import { Failure } from "@/features/player-ops/Failure";
import { readForPage } from "@/lib/api/flash";
import { loadCredential, type CredentialAct, type CredentialAttempt, type CredentialRecordView } from "@/lib/api/player";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { IAM08_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** Refusals the dialogue answers on its field; the rest are said above the device, where the board draws them. */
const ON_FIELD = new Set(["FIELD_MISSING", "FIELD_INVALID"]);

/**
 * SCR-IAM-08 Device detail and revocation: the device's credential, its state and since when, and the count of
 * evidence periods accepted from it, retained whatever happens here. Operations suspends, reinstates and revokes,
 * each with a reason kept on the record; revocation cannot be undone and never removes evidence.
 */
export default async function CredentialPage({ params, searchParams }: { params: Promise<{ credential: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-SEC");
  const [{ credential }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = iamopsTranslator(locale);
  const view = reviewView(query, IAM08_VIEWS);
  const attempt = readForPage<CredentialAttempt>(query);
  const mine = attempt?.page === "credential" && attempt.credential === credential ? attempt : null;
  const outcome = view === "loading" ? null : await loadCredential(staff, credential, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="deviceRegister" staff={staff} searchLabel={t("iamops.search")} keyMap={[{ keys: ["Esc"], label: t("iam08.kEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("iamops.area") }, { label: t("iam07.title"), href: routes.opsDeviceRegister() }]}
          // Without a record the page keeps the screen's own name: a device name there would say the record exists.
          title={data !== null ? (data.name ?? data.device) : t("iam08.pageTitle")}
          {...(data !== null
            ? { status: credentialStatus(data.state, t), meta: t("iam08.meta", { id: data.device, p: data.premises.name, u: moment(data.asOf, locale) }) }
            : {})}
          locale={locale}
        />
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={7} density="console" locale={locale} /> : null}
        {failure !== null && failure.code === "NOT_FOUND" ? (
          <ViewState
            view="empty"
            empty={{ variant: "governed", icon: "search", title: t("iam08.nfTitle"), text: t("iam08.nfText"), action: { label: t("iam08.nfBack"), href: routes.opsDeviceRegister() } }}
            density="console"
            level={2}
            locale={locale}
          />
        ) : failure !== null ? (
          <Failure failure={failure} errorText={t("iam08.errText")} prefix="iamops" t={t} locale={locale} />
        ) : null}
        {data !== null ? <Detail data={data} attempt={mine} visit={typeof query.attempt === "string" ? query.attempt : ""} staff={staff} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Detail({ data, attempt, visit, staff, t, locale }: { data: CredentialRecordView; attempt: CredentialAttempt | null; visit: string; staff: Staff; t: Translate; locale: Locale }) {
  const label = data.name !== null ? t("iam08.named", { name: data.name, id: data.device }) : data.device;
  const evidence = count(data.accepted, locale);
  const acts: CredentialAct[] = [...(data.state === "ACTIVE" ? (["suspend"] as const) : []), ...(data.state === "SUSPENDED" ? (["reinstate"] as const) : []), ...(data.state !== "REVOKED" ? (["revoke"] as const) : [])];
  const code = attempt?.code ?? null;
  const banner = code !== null && !ON_FIELD.has(code) ? refusalWords(code, t, "iamops") : null;
  const fieldError: { text: string; on: "text" | "date" } | null =
    code === null || !ON_FIELD.has(code)
      ? null
      : code === "FIELD_INVALID"
        ? { text: t("iam08.effectiveInvalid"), on: "date" }
        : { text: t(attempt?.act === "revoke" ? "iam08.causeMissing" : "iam08.reasonMissing"), on: "text" };
  const extra = [
    ...(data.state === "SUSPENDED" && data.reason !== null ? [{ label: t("iam08.fSusReason"), value: said(data.reason, locale) }] : []),
    ...(data.state === "ACTIVE" && data.reason !== null ? [{ label: t("iam08.fRein"), value: said(data.reason, locale) }] : []),
    ...(data.revocation !== null
      ? [
          { label: t("iam08.fCause"), value: said(data.revocation.cause, locale) },
          { label: t("iam08.fBy"), value: data.revocation.by === null ? t("iam08.byEvent") : t("iam08.byOfficer", { name: data.revocation.by }) },
        ]
      : []),
  ];
  const done = attempt?.done === true ? attempt.act : null;

  return (
    <>
      {banner !== null && code !== null ? (
        <Banner family={code === "AUTHORITY_NOT_IN_FORCE" || code === "PREMISES_RELATIONSHIP_ENDED" ? "attention" : "neutral"} title={banner.title} code={code} density="console" locale={locale}>
          {banner.text}
        </Banner>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-96), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <Panel title={t("iam08.devTitle")} density="console" locale={locale}>
          <FactList
            items={[
              // The device's PLR record, which the operations and the security officer both read (SCR-PLR-02).
              { label: t("iam08.fId"), value: data.device, kind: "id", action: { label: t("iam08.openRecord"), href: routes.opsDevice(data.device) } },
              { label: t("iam08.fState"), value: credentialStatus(data.state, t), kind: "status" },
              { label: t("iam08.fSince"), value: data.since, kind: "datetime" },
              ...extra,
              { label: t("iam08.fPremises"), value: data.premises.name },
              { label: t("iam08.fPurpose"), value: t("iamops.purpose.PLAYBACK") },
              { label: t("iam08.fPaired"), value: data.pairedAt, kind: "datetime" },
              { label: t("iam08.fLast"), value: data.lastUsedAt, kind: "datetime", missing: t("iam07.never") },
            ]}
            density="console"
            locale={locale}
          />
          {acts.length > 0 ? (
            <CredentialActions
              // Each answer opens the device afresh: no dialogue of the act before stays open.
              key={visit}
              credential={data.id}
              acts={acts}
              disabledReason={holds(staff, "ACT-OPS") ? null : t("iam08.authWhy")}
              reinstateReason={data.relationshipEnded ? t("iam08.relWhy") : null}
              open={fieldError !== null ? (attempt?.act ?? null) : null}
              error={fieldError}
              initial={attempt !== null && fieldError !== null ? attempt.values : null}
              revoke={{ min: data.pairedAt.slice(0, 10), helper: t("iam08.effectiveHelp", { p: moment(data.pairedAt, locale) }), label: t("iam08.effectiveAt") }}
              words={{
                reasonHelp: t("iam08.reasonHelp"),
                suspend: {
                  button: t("iam08.suspend"),
                  title: t("iam08.sTitle", { label }),
                  text: t("iam08.sText"),
                  facts: [
                    { label: t("iam08.fPremises"), value: data.premises.name },
                    { label: t("iam08.fLast"), value: data.lastUsedAt ?? t("iam07.never"), ...(data.lastUsedAt !== null ? { kind: "datetime" as const } : {}) },
                  ],
                  field: t("iam08.reason"),
                  confirm: t("iam08.sYes"),
                  keep: t("iam08.sKeep"),
                },
                reinstate: {
                  button: t("iam08.reinstate"),
                  title: t("iam08.rTitle", { label }),
                  text: t("iam08.rText"),
                  facts: [
                    { label: t("iam08.fPremises"), value: data.premises.name },
                    ...(data.reason !== null ? [{ label: t("iam08.fSusReason"), value: said(data.reason, locale) }] : []),
                  ],
                  field: t("iam08.reason"),
                  confirm: t("iam08.rYes"),
                  keep: t("iam08.rKeep"),
                },
                revoke: {
                  button: t("iam08.revoke"),
                  title: t("iam08.vTitle", { label }),
                  text: t("iam08.vText", { n: evidence }),
                  facts: [
                    { label: t("iam08.fPremises"), value: data.premises.name },
                    { label: t("iam08.fPaired"), value: data.pairedAt, kind: "datetime" },
                    { label: t("iam08.dEvidence"), value: data.accepted, kind: "count" },
                  ],
                  field: t("iam08.cause"),
                  confirm: t("iam08.vYes"),
                  keep: t("iam08.vKeep"),
                },
              }}
              locale={locale}
            />
          ) : (
            <Text size="sm" tone="secondary">
              {t("iam08.revokedNote")}
            </Text>
          )}
        </Panel>
        <Panel title={t("iam08.evTitle")} density="console" locale={locale}>
          <MetricValue label={t("iam08.evLabel")} value={data.accepted} kind="count" state="observed" note={t("iam08.evNote")} size="lg" locale={locale} />
        </Panel>
      </div>
      {done !== null ? (
        <Toast family="positive" title={t(`iam08.done.${done}`, { label })} floating locale={locale}>
          {done === "revoke" ? t("iam08.doneRevokeText", { n: evidence }) : t(`iam08.doneText.${done}`)}
        </Toast>
      ) : null}
    </>
  );
}

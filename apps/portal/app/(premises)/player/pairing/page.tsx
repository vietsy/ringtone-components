import { Banner, ButtonRow, Divider, FactList, PageHeader, Panel, SecretValue, Select, Table, Toast, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { issuePairing } from "@/features/venue/actions";
import { clock, iamTranslator } from "@/features/venue/copy";
import { LoadError, VenueShell } from "@/features/venue/Frame";
import { PairingPremises, RevokePairing } from "@/features/venue/PairingControls";
import { SubmitButton } from "@/features/venue/SubmitButton";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadPairing, type PairingAttempt, type PairingRow, type PairingState, type PairingStep } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { IAM06_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** SM-151's words and families: only an authorisation still waiting to be used is drawn as information. */
const STATE: Readonly<Record<PairingState, "info" | "neutral">> = { ISSUED: "info", CONSUMED: "neutral", EXPIRED: "neutral", REVOKED: "neutral" };

/** The refusals the page draws above the form or the code, and how each reads. */
const REFUSAL: Readonly<Record<string, "attention" | "neutral">> = {
  PAIRING_RATE_LIMIT_EXCEEDED: "attention",
  CONTACT_CHANNEL_NOT_VERIFIED: "attention",
  AUTHORITY_NOT_IN_FORCE: "attention",
  FIELD_INVALID: "attention",
  FIELD_MISSING: "attention",
  PAIRING_AUTHORISATION_CONSUMED: "neutral",
  PAIRING_AUTHORISATION_EXPIRED: "neutral",
};

/**
 * SCR-IAM-06 Issue a pairing authorisation. The premises principal issues a code for one premises and a device
 * purpose and reads it to the installer: the value is shown once, as it is issued, and never again, since RightOne
 * holds only its hash. It works once, within 15 minutes. The premises' codes are listed with what became of each,
 * never with their value.
 */
export default async function PairingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = iamTranslator(locale);
  const view = reviewView(query, IAM06_VIEWS);
  const asked = typeof query.premises === "string" ? query.premises : null;
  const outcome = view === "loading" ? null : await loadPairing(principal, asked, view);
  const last = readForPage<PairingAttempt>(query);
  const step = outcome?.data ?? null;
  const attempt = last?.page === "pairing" && step !== null && last.premises === step.chosen ? last : null;
  const failure = outcome?.failure ?? null;

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={{ premises: principal.party, period: t("iam06.principal"), label: t("iam06.ctxLabel") }}>
      <PageHeader crumbs={[{ label: t("iam06.crumb"), href: routes.player() }]} title={t("iam06.title")} meta={t("iam06.meta")} locale={locale} />
      {view === "loading" ? <ViewState view="loading" skeleton="card" rows={6} density="portal" locale={locale} /> : null}
      {failure !== null && failure.code === "AUTHORITY_NOT_IN_FORCE" ? <Refusal code={failure.code} premises={principal.party} t={t} locale={locale} /> : null}
      {failure !== null && failure.code !== "AUTHORITY_NOT_IN_FORCE" ? <LoadError failure={failure} locale={locale} /> : null}
      {step !== null ? <Pairing step={step} attempt={attempt} frame={frame} t={t} locale={locale} /> : null}
    </VenueShell>
  );
}

function Refusal({ code, premises, t, locale }: { code: string; premises: string; t: Translate; locale: Locale }) {
  return (
    <Banner family={REFUSAL[code] ?? "neutral"} title={t(`iam06.refusal.${code}.title`)} code={code} density="premises" live locale={locale}>
      {t(`iam06.refusal.${code}.text`, { premises })}
    </Banner>
  );
}

function Pairing({ step, attempt, frame, t, locale }: { step: PairingStep; attempt: PairingAttempt | null; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const chosen = step.premises.find((premises) => premises.id === step.chosen);
  const issued = attempt?.issued ?? null;
  const row = issued !== null ? step.items.find((item) => item.id === issued.id) : undefined;
  // The value is shown only while the code it names is still issued: once used, expired or revoked, the form returns.
  const showCode = issued !== null && row !== undefined && row.state === "ISSUED";
  const revoked = attempt?.revoke !== null && attempt?.revoke !== undefined && attempt.code === null ? step.items.find((item) => item.id === attempt.revoke?.id) : undefined;
  const premisesName = chosen?.name ?? "";
  const purpose = t("iam06.playback");
  const issueForm = (
    // display: contents keeps the form out of the ButtonRow's layout; it only carries the premises and purpose.
    <form action={issuePairing} style={{ display: "contents" }}>
      <input type="hidden" name="premises_id" value={step.chosen} />
      <input type="hidden" name="purpose" value="PLAYBACK" />
      <SubmitButton variant="secondary" size="md" icon="plus" fullWidth={phone} locale={locale}>
        {t("iam06.another")}
      </SubmitButton>
    </form>
  );
  return (
    <>
      {attempt !== null && attempt.code !== null ? <Refusal code={attempt.code} premises={premisesName} t={t} locale={locale} /> : null}
      {showCode && row !== undefined ? (
        <Panel title={t("iam06.codeTitle")} status={{ family: "info", label: t("iam06.state.ISSUED") }} gap="lg" inset={inset} density="portal" locale={locale}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--space-6) var(--space-10)" }}>
            <div style={{ flex: "999 1 var(--space-80)", minWidth: 0 }}>
              <SecretValue size="lg" spell label={t("iam06.codeLabel")} value={issued.value} copyLabel={t("iam06.copy")} note={t("iam06.once")} density="portal" locale={locale} />
            </div>
            <div style={{ flex: "1 1 var(--space-48)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <Text size="base" tone="secondary">
                {t("iam06.expiresLabel")}
              </Text>
              <Text size="lg" weight="semibold">
                {clock(row.expiresAt)}
              </Text>
              <Text size="base" tone="secondary">
                {t("iam06.expiresNote")}
              </Text>
            </div>
          </div>
          <Divider />
          <FactList
            items={[
              { label: t("iam06.fPremises"), value: row.premises.name },
              { label: t("iam06.fPurpose"), value: purpose },
              { label: t("iam06.fIssued"), value: row.issuedAt, kind: "datetime" },
              { label: t("iam06.fBy"), value: t(`iam06.by.${row.issuedBy.actor}`, { name: row.issuedBy.name }) },
              { label: t("iam06.fUses"), value: t("iam06.usesOne") },
            ]}
            columns={phone ? 1 : 2}
            density="portal"
            locale={locale}
          />
          <Divider />
          <ButtonRow>
            {issueForm}
            <RevokePairing
              premises={step.chosen}
              authorisation={row.id}
              copy={{
                revoke: t("iam06.revoke"),
                title: t("iam06.dlgTitle", { time: clock(row.issuedAt) }),
                text: t("iam06.dlgText"),
                reason: t("iam06.reason"),
                reasonHelp: t("iam06.reasonHelp"),
                reasonMissing: t("iam06.reasonMissing"),
                confirm: t("iam06.revokeYes"),
                keep: t("iam06.keep"),
              }}
              facts={[
                { label: t("iam06.fPremises"), value: row.premises.name },
                { label: t("iam06.dExpires"), value: row.expiresAt, kind: "datetime" },
              ]}
              phone={phone}
              locale={locale}
            />
          </ButtonRow>
        </Panel>
      ) : (
        <Panel gap="xl" inset={inset} density="portal" locale={locale}>
          <form action={issuePairing} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Panel variant="plain" level={2} title={t("iam06.formTitle")} density="portal" locale={locale}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--space-6)", maxWidth: "var(--container-2xl)" }}>
                <PairingPremises
                  legend={t("iam06.fPremises")}
                  options={step.premises.map((premises) => ({ value: premises.id, label: premises.name }))}
                  chosen={step.chosen}
                  hrefFor={Object.fromEntries(step.premises.map((premises) => [premises.id, routes.playerPairing(premises.id)]))}
                  locale={locale}
                />
                <Select
                  label={t("iam06.fPurpose")}
                  helper={t("iam06.purposeHelp")}
                  options={step.purposes.map((value) => ({ value, label: purpose }))}
                  value="PLAYBACK"
                  {...(attempt?.code === "FIELD_INVALID" ? { error: t("iam06.purposeInvalid") } : {})}
                  required
                  name="purpose"
                  density="portal"
                  locale={locale}
                />
              </div>
            </Panel>
            <Divider />
            <Text size="base" measure="2xl">
              {t("iam06.formNote")}
            </Text>
            <div style={{ display: "flex", flexDirection: phone ? "column" : "row" }}>
              <SubmitButton variant="primary" size="md" fullWidth={phone} locale={locale}>
                {t("iam06.issue")}
              </SubmitButton>
            </div>
          </form>
        </Panel>
      )}
      <Panel title={t("iam06.histTitle")} inset={inset} density="portal" locale={locale}>
        <Table
          columns={[
            { key: "issued", label: t("iam06.cIssued"), kind: "datetime" },
            { key: "purpose", label: t("iam06.cPurpose") },
            { key: "state", label: t("iam06.cState"), kind: "status" },
            { key: "outcome", label: t("iam06.cOutcome"), minWidth: "var(--space-64)" },
          ]}
          rows={step.items.map((item) => ({
            _key: item.id,
            issued: item.issuedAt,
            purpose,
            state: { family: STATE[item.state], label: t(`iam06.state.${item.state}`) },
            outcome: outcomeOf(item, t, locale),
          }))}
          layout={phone ? "cards" : "table"}
          density="portal"
          caption={t("iam06.histTitle")}
          {...(step.items.length > 0 ? { sortNote: t("iam06.sortNote") } : {})}
          empty={{ variant: "not-started", title: t("iam06.emptyTitle"), action: false }}
          locale={locale}
        />
      </Panel>
      {revoked !== undefined ? (
        <Toast family="positive" title={t("iam06.doneTitle", { time: clock(revoked.issuedAt) })} floating locale={locale}>
          {t("iam06.doneText")}
        </Toast>
      ) : null}
    </>
  );
}

/** What became of a code, in a sentence: not used yet, the device it paired, expired unused, or revoked and why. */
function outcomeOf(item: PairingRow, t: Translate, locale: Locale): string {
  switch (item.state) {
    case "ISSUED":
      return t("iam06.oIssued", { time: clock(item.expiresAt) });
    case "CONSUMED":
      return item.device !== null
        ? t("iam06.oUsed", { device: item.device.name !== null ? `${item.device.name}, ${item.device.id}` : item.device.id, time: clock(item.consumedAt ?? item.issuedAt) })
        : t("iam06.oUsedNow", { time: clock(item.consumedAt ?? item.issuedAt) });
    case "EXPIRED":
      return t("iam06.oExpired");
    case "REVOKED":
      return t("iam06.oRevoked", { time: clock(item.revokedAt ?? item.issuedAt), reason: item.reason?.[locale] ?? "" }).trim();
  }
}


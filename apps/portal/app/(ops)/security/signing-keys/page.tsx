import { R1_FORMAT } from "@rightone/formatting";
import { Banner, EmptyState, PageHeader, Panel, Skeleton, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { registerKeyAction, retireKeyAction, revokeKeyAction } from "@/features/status-records/actions";
import { ConsoleFailure } from "@/features/status-records/console";
import { KeyRegistration } from "@/features/status-records/KeyRegistration";
import { KeyTable } from "@/features/status-records/KeyTable";
import { columnTime, keyStatus, timestamp } from "@/features/status-records/words";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff } from "@/lib/api/session";
import { loadSigningKeys, type KeyAttempt, type SigningKeyRow, type SigningKeys } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER10_VIEWS } from "@/lib/mock/status-records";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** The refusals of Register a key drawn below the field they name. The values are catalogue keys, not secrets. */
const FIELD_WORDS: Readonly<Record<string, string>> = { KID_EXISTS: "cer10.kidExists", KEY_INVALID: "cer10.keyInvalid", VALID_FROM_IN_PAST: "cer10.fromPast" }; // gitleaks:allow

/**
 * SCR-CER-10 Signing keys, on the security console. Each printout of a status record is signed with the key that
 * signs at that moment; a key is due for retirement twelve months after it starts signing and is retired by hand.
 * The security administrator registers a key the key service holds, retires one (it still verifies what it signed)
 * and revokes one (nothing it signed verifies); the auditor reads.
 */
export default async function SigningKeysPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The security administrator acts; the auditor reads.
  const staff = await requireStaff("ACT-SEC", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, CER10_VIEWS);
  const attempt = view === null ? readForPage<KeyAttempt>(params) : null;
  const outcome = view === "loading" ? null : await loadSigningKeys(staff.sessionId, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const security = holds(staff, "ACT-SEC");

  return (
    <OpsFrame
      console="security"
      current="keys"
      staff={staff}
      searchLabel={t("cer.secSearch")}
      keyMap={[{ keys: ["↑", "↓"], label: t("cer10.kMove") }]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cer10.crumb") }]}
          title={t("cer10.title")}
          {...(data !== null ? { meta: t("cer10.meta", { ts: timestamp(data.asOf, locale) }) + (security ? "" : t("cer10.metaRead")) } : {})}
          locale={locale}
        />
        {failure !== null ? (
          <ConsoleFailure failure={failure} refusals={{}} back={null} t={t} locale={locale} />
        ) : (
          <Keys data={data} security={security} attempt={attempt} signingDown={view === "signing-unavailable"} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Keys({
  data,
  security,
  attempt,
  signingDown,
  t,
  locale,
}: {
  data: SigningKeys | null;
  security: boolean;
  attempt: KeyAttempt | null;
  signingDown: boolean;
  t: Translate;
  locale: Locale;
}) {
  const keys = data?.keys ?? [];
  const signer = keys.find((key) => key.signsNow) ?? null;
  const done = attempt?.done ?? null;
  const register = attempt?.register ?? null;
  const row = attempt?.row ?? null;
  const reasonMissing = row?.code === "REASON_REQUIRED" ? row : null;
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);

  const toast =
    done === null
      ? null
      : done.kind === "registered"
        ? {
            title: t("cer10.regToastTitle", { kid: done.kid }),
            text:
              signer !== null && signer.kid !== done.kid
                ? t("cer10.regToastText", { ts: timestamp(done.validFrom, locale), old: signer.kid })
                : t("cer10.regToastTextPlain", { ts: timestamp(done.validFrom, locale) }),
          }
        : done.kind === "retired"
          ? { title: t("cer10.retToastTitle", { kid: done.kid }), text: null }
          : { title: t("cer10.revToastTitle", { kid: done.kid }), text: done.reprint === 0 ? t("cer10.revToastText") : t("cer10.revToastTextN", { n: count(done.reprint) }) };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      {toast !== null && security && (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={toast.title} locale={locale}>
            {toast.text}
          </Toast>
        </div>
      )}
      {(signingDown || register?.refusal?.code === "SIGNING_UNAVAILABLE") && (
        <Banner family="attention" title={t("cer10.suTitle")} code="SIGNING_UNAVAILABLE" density="console" live locale={locale}>
          {t("cer.refusal.SIGNING_UNAVAILABLE")}
        </Banner>
      )}
      {data !== null && keys.length === 0 ? (
        <EmptyState variant="not-started" icon="key-round" title={t("cer10.emptyTitle")} level={2} action={false} density="console" locale={locale}>
          {t("cer10.emptyText")}
        </EmptyState>
      ) : (
        <KeyTable
          columns={[
            { key: "kid", label: t("cer10.cKey"), kind: "id" },
            { key: "st", label: t("cer10.cState"), kind: "status", minWidth: "var(--space-40)" },
            { key: "from", label: t("cer10.cFrom"), kind: "stack", unit: "GMT+7", nowrap: true },
            { key: "retireBy", label: t("cer10.cRetireBy"), kind: "date", short: true },
            { key: "signed", label: t("cer10.cSigned"), kind: "count", unit: t("cer10.uSigned"), minWidth: "var(--space-20)" },
            ...(security ? [{ key: "actions", kind: "actions" as const }] : []),
          ]}
          rows={keys.map((key) => keyRow(key, row !== null && row.code !== "REASON_REQUIRED" && row.kid === key.kid ? row.code : null, t, locale))}
          acts={security ? { retire: retireKeyAction, revoke: revokeKeyAction } : null}
          reopenRevoke={reasonMissing !== null ? { kid: reasonMissing.kid, error: t("cer.refusal.REASON_REQUIRED") } : null}
          words={{
            retire: t("cer10.retire"),
            revoke: t("cer10.revoke"),
            cancel: t("cer10.cancel"),
            retireTitle: t("cer10.retireTitle"),
            retireText: t("cer10.retireText"),
            retireYes: t("cer10.retireYes"),
            revokeTitle: t("cer10.revokeTitle"),
            revokeText: t("cer10.revokeText"),
            revokeYes: t("cer10.revokeYes"),
            reason: t("cer10.fReason"),
            reasonHelp: t("cer10.fReasonHelp"),
          }}
          caption={t("cer10.caption")}
          sortNote={t("cer10.sortNote")}
          loading={data === null ? 2 : false}
          locale={locale}
        />
      )}
      {security && (
        <div style={{ maxWidth: "var(--container-4xl)" }}>
          <Panel title={t("cer10.regTitle")} description={t("cer10.regDesc")} level={2} gap="lg" compact locale={locale}>
            {data === null ? (
              <Skeleton variant="card" rows={4} density="console" locale={locale} />
            ) : (
              <form action={registerKeyAction} noValidate style={{ display: "contents" }}>
                <KeyRegistration
                  // A registration that went through leaves the form empty for the next key.
                  key={done?.kind === "registered" ? done.kid : "register"}
                  values={register?.values ?? {}}
                  errors={
                    (register?.refusal?.field !== undefined && register?.refusal?.field !== null) && FIELD_WORDS[register.refusal.code] !== undefined
                      ? { [register.refusal.field]: t(FIELD_WORDS[register.refusal.code] ?? "") }
                      : {}
                  }
                  today={data.today}
                  words={{
                    kid: t("cer10.fKid"),
                    kidHelp: t("cer10.fKidHelp"),
                    handle: t("cer10.fHandle"),
                    handleHelp: t("cer10.fHandleHelp"),
                    jwk: t("cer10.fJwk"),
                    jwkHelp: t("cer10.fJwkHelp"),
                    from: t("cer10.fFrom"),
                    fromHelp: t("cer10.fFromHelp"),
                    register: t("cer10.register"),
                    registerWhy: t("cer10.registerWhy"),
                  }}
                  locale={locale}
                />
              </form>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function keyRow(key: SigningKeyRow, refusal: string | null, t: Translate, locale: Locale) {
  const status = keyStatus(t, key.state);
  const detail =
    key.state === "ACTIVE" ? t(key.signsNow ? "cer10.dNow" : "cer10.dNotYet") : key.state === "REVOKED" && key.revokedAt !== null ? t("cer10.dRevoked", { ts: timestamp(key.revokedAt, locale) }) : null;
  return {
    kid: key.kid,
    cells: {
      kid: key.kid,
      st: detail !== null ? { ...status, detail } : status,
      from: { text: columnTime(key.validFrom, locale), plain: true },
      retireBy: key.retireBy,
      signed: key.signed,
    },
    canRetire: key.state === "ACTIVE",
    canRevoke: key.state !== "REVOKED",
    refusal: refusal !== null ? { message: t(`cer.refusal.${refusal === "LAST_SIGNING_KEY" || refusal === "KEY_NOT_ACTIVE" || refusal === "KEY_ALREADY_REVOKED" || refusal === "KEY_NOT_FOUND" ? refusal : "NOT_AUTHORISED"}`), code: refusal } : null,
    facts: [
      { label: t("cer10.fSignsFrom"), value: key.validFrom, kind: "datetime" as const },
      { label: t("cer10.fSigned"), value: t("cer10.printouts", { n: R1_FORMAT.formatCount(key.signed, locale) ?? String(key.signed) }) },
    ],
  };
}

import { redirect } from "next/navigation";
import { Button, ButtonRow, FactList, PageHeader, Panel, Skeleton, Toast, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { declareAction, searchSourceAction } from "@/features/parties/actions";
import { codeStatus, evidenceWords, moment, partyTranslator, refusal, sourceLine } from "@/features/parties/copy";
import { IdentificationForm } from "@/features/parties/IdentificationForm";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { readForPage } from "@/lib/api/flash";
import { loadIdentificationForm, type IdentificationForm as FormData, type PartyAttempt, type SourceCondition } from "@/lib/api/parties";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS, PTY03_SOURCE_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The source's condition a reviewer may draw instead of the one the backend reports (the P1 frame, an outage). */
const SOURCE_VIEW: Readonly<Record<(typeof PTY03_SOURCE_VIEWS)[number], SourceCondition>> = { "no-source": "NOT_CONFIGURED", "source-unreachable": "UNREACHABLE" };

/**
 * SCR-PTY-03 Identification, an operator's act on the console (SEC-203: a party may not identify itself, so no portal
 * screen declares one). The route is the officer's choice, with the source's reachability beside it as text; a
 * declaration by hand takes the evidence, its reference, a scan and the reason, and the person declaring comes from
 * the session. What DR-200 will do is said before Declare: where the source answered with no match the declaration
 * goes to review and the party is REFERRED until a review decides. An officer the party's own authorities name meets
 * SELF_IDENTIFICATION_REFUSED in place of the form.
 */
export default async function IdentificationPage({ params, searchParams }: { params: Promise<{ party: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const { party: record } = await params;
  const query = await searchParams;
  const locale = await getLocale();
  const t = partyTranslator(locale);
  const asked = reviewView(query, PARTIES_VIEWS);
  const sourceView = reviewView(query, PTY03_SOURCE_VIEWS);
  const outcome = asked === "loading" ? null : await loadIdentificationForm(staff, record, asked);
  const loaded = outcome?.data ?? null;
  const data = loaded !== null && sourceView !== null ? { ...loaded, source: { ...loaded.source, condition: SOURCE_VIEW[sourceView] } } : loaded;
  const failure = outcome?.failure ?? null;
  // Only a party in DRAFT is identified here, and a declaration waiting for review is shown here; any other party's
  // page says how it stands (an identified one, or one referred by a duplicate review).
  if (data !== null && data.state !== "DRAFT" && data.declared === null) redirect(routes.opsParty(record));
  const attempt = readForPage<PartyAttempt>(query);

  return (
    <OpsFrame console="operations" current="parties" staff={staff} searchLabel={t("party.search")} keyMap={[{ keys: ["Esc"], label: t("pty03.kEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("party.crumb") }, { label: t("pty01.title"), href: routes.opsParties() }, ...(data !== null ? [{ label: data.legalName, href: routes.opsParty(record) }] : [])]}
          title={data !== null ? t("pty03.title", { name: data.legalName }) : t("pty03.titleGeneric")}
          {...(data !== null ? { status: codeStatus(data.state, t), meta: meta(data, t) } : {})}
          locale={locale}
        />
        {failure !== null ? (
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <PartyFailure failure={failure} screen="pty02" errorTitle={t("pty02.errTitle")} density="console" t={t} locale={locale} />
          </div>
        ) : data === null ? (
          <Panel locale={locale}>
            <Skeleton variant="facts" rows={6} density="console" locale={locale} />
          </Panel>
        ) : data.selfRefused ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            <ViewState view="refused" refusal={{ ...refusal(t, "SELF_IDENTIFICATION_REFUSED", "pty03"), family: "attention" }} density="console" locale={locale} />
            <Button variant="secondary" size="sm" href={routes.opsParty(record)} locale={locale}>
              {t("pty03.backParty")}
            </Button>
          </div>
        ) : data.declared !== null ? (
          <Declared data={data} declared={data.declared} justNow={attempt?.form === "declare" && attempt.refusal === null} t={t} locale={locale} />
        ) : (
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <IdentificationForm
              data={data}
              search={searchSourceAction.bind(null, record)}
              declare={declareAction.bind(null, record)}
              partyHref={routes.opsParty(record)}
              attempt={attempt !== null && attempt.subject === record ? attempt : null}
              locale={locale}
            />
          </div>
        )}
      </div>
    </OpsFrame>
  );
}

function meta(data: FormData, t: Translate): string {
  const kind = t(`party.kindInline.${data.kind}`);
  return data.businessRegistration !== null ? t("pty03.meta", { rec: data.record, kind, reg: data.businessRegistration }) : t("pty03.metaNoReg", { rec: data.record, kind });
}

/** The declaration recorded and the review it waits in: nothing closes a review but a decision. */
function Declared({ data, declared, justNow, t, locale }: { data: FormData; declared: NonNullable<FormData["declared"]>; justNow: boolean; t: Translate; locale: Locale }) {
  const declaration = declared.identification.declaration;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
      {justNow ? (
        <Toast family="positive" title={t("pty03.toastTitle")} locale={locale}>
          {t("pty03.toastText", { name: data.legalName })}
        </Toast>
      ) : null}
      <Panel title={t("pty03.recorded")} description={t("pty03.recordedDesc")} compact locale={locale}>
        <FactList
          items={[
            { label: t("pty03.fRoute"), value: t("pty03.manual") },
            { label: t("pty03.fSource"), value: sourceLine(declared.identification, t, locale) },
            ...(declaration !== null
              ? [
                  { label: t("pty03.fEvidence"), value: evidenceWords(declaration.evidenceKind, t) },
                  { label: t("pty03.evRef"), value: declaration.evidenceRef, kind: "mono" as const },
                  { label: t("pty03.fReason"), value: declaration.reason },
                  { label: t("pty03.operator"), value: declaration.by },
                ]
              : []),
            ...(declared.identification.at !== null ? [{ label: t("pty03.fDeclaredAt"), value: declared.identification.at, kind: "datetime" as const }] : []),
            { label: t("pty03.fReview"), value: codeStatus("OPEN", t), kind: "status", note: t("pty03.reviewOpen", { ts: moment(declared.openedAt, locale) }) },
          ]}
          density="console"
          locale={locale}
        />
        <ButtonRow>
          <Button variant="secondary" size="sm" href={routes.opsIdentificationReview(declared.review)} locale={locale}>
            {t("pty03.openReview")}
          </Button>
          <Button variant="quiet" size="sm" href={routes.opsParty(data.record)} locale={locale}>
            {t("pty03.backParty")}
          </Button>
        </ButtonRow>
      </Panel>
    </div>
  );
}

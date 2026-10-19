import { R1_FORMAT } from "@rightone/formatting";
import {
  ApprovalPair,
  Banner,
  Button,
  Columns,
  Comparison,
  FactList,
  PageHeader,
  Panel,
  Skeleton,
  StatusLine,
  Toast,
  ViewState,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ActConfirm } from "@/features/public/ActConfirm";
import { decideVersionAct, withdrawVersionAct } from "@/features/public/console-actions";
import { day, decides, documentTitle, moment, pubTranslator, refusalWords, versionState, versionTitle, type PolicyAttempt } from "@/features/public/console";
import { VersionDecision } from "@/features/public/VersionDecision";
import { readForPage } from "@/lib/api/flash";
import { loadDocumentVersion, type VersionDetail, type VersionLine } from "@/lib/api/public";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { POLICY_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PUB-16 Approve a version: the submitted text against the version in effect, section by section; who prepared
 * it beside who decides; the plain-language review a page needs; and Approve and publish or Return, each confirmed.
 * Only the approver of the version's class decides it, never its author (`DR-494`): a page by the policy approver, a
 * legal document by the legal approver holding the release decision. Anyone else who opens it reads it with the
 * refusal in the header: the author, SEGREGATION_REQUIRED; a reader without the decision, NOT_AUTHORISED. A version
 * published and not yet in effect can still be withdrawn here by such an approver.
 */
export default async function ApproveVersionPage({ params, searchParams }: { params: Promise<{ version: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-OPS", "ACT-POL-APR", "ACT-LGL");
  const [{ version: id }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = pubTranslator(locale);
  const view = reviewView(query, POLICY_VIEWS);
  const kept = readForPage<PolicyAttempt>(query);
  const attempt = kept !== null && kept.on === id ? kept : null;
  const outcome = view === "loading" ? null : await loadDocumentVersion(staff, id, view);
  const version = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // Who may not decide this version, and why: its author first, as the board draws the author reading it.
  const standing: "author" | "no-decision" | null =
    version === null ? null : version.reader.isAuthor ? "author" : !decides(version.reader, version.documentClass) ? "no-decision" : null;
  const refusal = attempt?.refusal ?? null;
  // The reader's own standing on a submitted version, which holds the decision back whatever was just answered.
  const standingRefusal = version?.status === "SUBMITTED" && standing !== null ? { code: standing === "author" ? "SEGREGATION_REQUIRED" : "NOT_AUTHORISED", field: null, values: {} } : null;
  const shownRefusal = refusal !== null && refusal.field !== "reason" && refusal.field !== "plain_language_confirmed" ? refusal : standingRefusal;

  return (
    <OpsFrame console="policy" current="documents" staff={staff} searchLabel={t("pubc.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("pubc.policy") }, { label: t("pubc.docs"), href: routes.policyDocuments() }]}
          title={version !== null ? versionTitle(version.kind, version.label, t) : t("pubc.docs")}
          {...(version !== null ? { status: versionState(version, t), ...(version.submittedAt !== null && version.draftedBy !== null ? { meta: t("pub16.meta", { name: version.draftedBy, ts: moment(version.submittedAt, locale) }) } : {}) } : {})}
          locale={locale}
        />
        {version !== null ? <Outcome attempt={attempt} version={version} t={t} locale={locale} /> : null}
        {shownRefusal !== null ? (
          <Banner family="attention" title={refusalWords(shownRefusal, t).title} code={shownRefusal.code} live={refusal !== null} density="console" locale={locale}>
            {refusalWords(shownRefusal, t).text}
          </Banner>
        ) : null}
        {view === "loading" ? (
          <Columns>
            <Panel density="console" locale={locale}>
              <Skeleton variant="table" rows={3} columns={3} density="console" locale={locale} />
            </Panel>
            <Panel as="aside" title={t("pub16.factsTitle")} level={2} density="console" locale={locale}>
              <Skeleton variant="facts" rows={4} density="console" locale={locale} />
            </Panel>
          </Columns>
        ) : null}
        {failure !== null ? (
          failure.code === "NOT_AUTHORISED" || failure.code === "VERSION_NOT_FOUND" ? (
            <ViewState
              view="refused"
              refusal={{ code: failure.code, title: refusalWords(failure, t).title, text: refusalWords(failure, t).text ?? "", family: failure.code === "NOT_AUTHORISED" ? "attention" : "neutral" }}
              level={2}
              density="console"
              locale={locale}
            />
          ) : (
            <ViewState view="error" errorTitle={t("pubc.errTitle")} errorText={t("pubc.errText")} {...(failure.traceId !== null ? { traceId: failure.traceId } : {})} retryable={failure.retryable} level={2} density="console" locale={locale} />
          )
        ) : null}
        {version !== null ? <Review version={version} attempt={attempt} refusedBy={standingRefusal !== null ? refusalWords(standingRefusal, t).title : null} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** What the decision just recorded did, in place: published, returned, withdrawn. */
function Outcome({ attempt, version, t, locale }: { attempt: PolicyAttempt | null; version: VersionDetail; t: Translate; locale: Locale }) {
  if (attempt === null || attempt.refusal !== null) return null;
  const refs = version.sourceRefs.map((source) => source.ref).join(", ");
  const at = version.effectiveFrom !== null ? moment(version.effectiveFrom, locale) : "";
  const toast =
    attempt.act === "approve"
      ? { family: "positive" as const, title: t("pub16.approvedTitle", { version: version.label }), text: refs !== "" ? t("pub16.approvedWatches", { ts: at, refs }) : t("pub16.approvedText", { ts: at }) }
      : attempt.act === "return"
        ? { family: "info" as const, title: t("pub16.returnedTitle", { version: version.label, name: version.draftedBy ?? "" }), text: t("pub16.returnedText", { reason: version.decisionReason ?? "" }) }
        : attempt.act === "withdraw"
          ? { family: "neutral" as const, title: t("pub16.withdrawnTitle", { version: version.label }), text: t("pub16.withdrawnText") }
          : null;
  if (toast === null) return null;
  return (
    <div style={{ maxWidth: "var(--container-lg)" }}>
      <Toast family={toast.family} title={toast.title} locale={locale}>
        {toast.text}
      </Toast>
    </div>
  );
}

/** The version a newly published one ends: the latest published before it, in effect or upcoming. */
function endedBy(version: VersionDetail): VersionLine | null {
  const from = Date.parse(version.effectiveFrom ?? "");
  const lines = [version.standing.inEffect, ...version.standing.upcoming].filter(
    (line): line is VersionLine => line !== null && line.id !== version.id && line.effectiveFrom !== null && Date.parse(line.effectiveFrom) < from,
  );
  return lines.sort((a, b) => Date.parse(b.effectiveFrom ?? "") - Date.parse(a.effectiveFrom ?? ""))[0] ?? null;
}

function Review({ version, attempt, refusedBy, t, locale }: { version: VersionDetail; attempt: PolicyAttempt | null; refusedBy: string | null; t: Translate; locale: Locale }) {
  const page = version.documentClass === "PAGE";
  const doc = documentTitle(version.kind, t);
  const { difference } = version;
  const diffTitle =
    difference.against === null
      ? t("pub16.diffNone")
      : version.phase === "IN_EFFECT" || version.phase === "SUPERSEDED"
        ? t("pub16.diffPrior", { version: difference.against })
        : t("pub16.diffTitle", { version: difference.against });
  const effective = version.effectiveFrom !== null ? moment(version.effectiveFrom, locale) : "-";
  const ended = endedBy(version);
  // A version that starts at midnight ends the one before it at the end of the day before; one that starts later ends it at its instant.
  const prev =
    ended === null || ended.effectiveFrom === null || version.effectiveFrom === null
      ? ""
      : R1_FORMAT.formatTime(version.effectiveFrom) === "00:00"
        ? t("pub16.dlgPrevDay", { version: ended.label, from: day(ended.effectiveFrom, locale), last: day(new Date(Date.parse(version.effectiveFrom) - 1).toISOString(), locale) })
        : t("pub16.dlgPrevInstant", { version: ended.label, from: day(ended.effectiveFrom, locale), ts: effective });
  const submitted = version.status === "SUBMITTED";
  const upcoming = version.status === "PUBLISHED" && version.phase === "UPCOMING";
  const typedReason = attempt !== null && typeof attempt.typed.reason === "string" ? attempt.typed.reason : "";
  const reasonRefused = attempt?.refusal?.field === "reason" ? attempt.refusal : null;
  const plainRefused = attempt?.refusal?.field === "plain_language_confirmed" ? attempt.refusal : null;
  const sentence = (refused: typeof reasonRefused) => (refused === null ? null : [refusalWords(refused, t).title, refusalWords(refused, t).text].filter((part) => part !== null).join(" "));

  return (
    <Columns>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Panel title={diffTitle} level={2} density="console" locale={locale}>
          {!difference.held && difference.against !== null ? <StatusLine family="info" text={t("pub16.diffNotHeld", { version: difference.against })} locale={locale} /> : null}
          <Comparison
            columns={[
              { key: "now", label: difference.against ?? t("pub15.fInEffect") },
              { key: "read", label: version.label },
            ]}
            rows={difference.rows.map((row) => ({
              key: row.key,
              label: row.heading[locale],
              values: { now: row.inEffect?.[locale] ?? null, read: row.read?.[locale] ?? null },
              changed: row.changed,
              missing: row.read === null ? t("pub16.removed") : t("pub16.absent"),
            }))}
            rowLabel={t("pub16.section")}
            caption={diffTitle}
            density="console"
            locale={locale}
          />
        </Panel>
        {submitted ? (
          <Panel title={t("pub16.decideTitle")} gap="lg" level={2} density="console" locale={locale}>
            <VersionDecision
              action={decideVersionAct}
              version={version.id}
              label={version.label}
              isPage={page}
              initial={{ plain: attempt?.typed.plain === "on", reason: typedReason }}
              errors={{ plain: sentence(plainRefused), reason: sentence(reasonRefused) }}
              refusedBy={refusedBy}
              backHref={routes.policyDocuments()}
              words={{
                plain: t("pub16.plain"),
                plainHelp: t("pub16.plainHelp"),
                reason: t("pub16.reason"),
                reasonHelp: t("pub16.reasonHelp"),
                row: t("pub16.decision"),
                approve: t("pub16.approve"),
                return: t("pub16.return"),
                back: t("pub15.back"),
                approveWhy: t("pub16.approveWhy"),
                returnWhy: t("pub16.returnWhy"),
                cancel: t("pubc.cancel"),
                approveDialog: {
                  title: t(page ? "pub16.dlgApprovePage" : "pub16.dlgApproveLegal", { version: version.label, doc, ts: effective }),
                  description: [t("pub16.dlgShows"), prev].filter((part) => part !== "").join(" "),
                  confirm: t("pub16.dlgApproveYes", { version: version.label }),
                  facts: [
                    { label: t("pub16.fDoc"), value: doc },
                    { label: t("pub16.fEffective"), value: version.effectiveFrom ?? "", kind: "datetime" },
                  ],
                },
                returnDialog: {
                  title: t(page ? "pub16.dlgReturnPage" : "pub16.dlgReturnLegal", { version: version.label, doc, name: version.draftedBy ?? "" }),
                  description: t("pub16.dlgReturnText"),
                  confirm: t("pub16.dlgReturnYes", { version: version.label }),
                },
              }}
              locale={locale}
            />
          </Panel>
        ) : (
          <div>
            <Button variant="quiet" size="sm" icon="arrow-left" href={routes.policyDocuments()} locale={locale}>
              {t("pub15.back")}
            </Button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        {version.draftedBy !== null ? (
          <ApprovalPair
            preparer={{ name: version.draftedBy, role: t(`pub16.rolePreparer${version.documentClass}`), ...(version.submittedAt !== null ? { at: version.submittedAt } : {}) }}
            approver={version.decidedBy !== null && version.decidedAt !== null ? { name: version.decidedBy, role: t(`pub16.roleApprover${version.documentClass}`), at: version.decidedAt } : null}
            {...(version.decidedBy === null
              ? { awaiting: t(page ? "pub15.awaitingPage" : "pub15.awaitingLegal") }
              : version.lastDecision === "RETURN"
                ? { decision: "returned" as const, ...(version.decisionReason !== null ? { comment: version.decisionReason } : {}) }
                : { decision: "approved" as const })}
            preparerLabel={t("pub16.preparerLabel")}
            approverLabel={t("pub16.approverLabel")}
            locale={locale}
          />
        ) : null}
        <Panel as="aside" title={t("pub16.factsTitle")} level={2} density="console" locale={locale}>
          <FactList
            items={[
              { label: t("pub16.fDoc"), value: t(`pubc.class.${version.documentClass}`) },
              { label: t("pub16.fEffective"), value: version.effectiveFrom, kind: "datetime" as const, missing: t("pub16.absent") },
              { label: t("pub16.fSubmitted"), value: version.submittedAt, kind: "datetime" as const, missing: t("pub16.absent") },
              ...(version.sourceKinds.length > 0 ? [{ label: t("pub16.fSources"), value: version.sourceRefs.map((source) => source.ref).join(", ") || null, kind: "mono" as const, missing: t("pub15.sourceNone") }] : []),
              { label: t("pub16.fDigest"), value: version.digest, kind: "mono" as const, missing: t("pub16.absent") },
            ]}
            density="console"
            locale={locale}
          />
        </Panel>
        {upcoming && (version.reader.isAuthor || decides(version.reader, version.documentClass)) ? (
          <Panel as="aside" title={t("pub16.withdrawTitle")} description={t("pub16.withdrawNote")} level={2} density="console" locale={locale}>
            <div>
              <ActConfirm
                action={withdrawVersionAct}
                fields={{ version: version.id, label: version.label, from: "review" }}
                label={t("pub16.withdraw")}
                icon="x"
                {...(version.reader.isAuthor ? { disabledReason: refusalWords({ code: "SEGREGATION_REQUIRED" }, t).title } : {})}
                dialog={{
                  title: t(page ? "pub16.dlgWithdrawPage" : "pub16.dlgWithdrawLegal", { version: version.label, doc }),
                  description: t("pub15.dlgPublished", { ts: effective }),
                  confirm: t("pub15.dlgYes", { version: version.label }),
                  confirmVariant: "danger",
                  back: t("pubc.cancel"),
                }}
                reason={{ label: t("pub16.wdReason"), value: attempt?.act === "withdraw" && typeof attempt.typed.reason === "string" ? attempt.typed.reason : "" }}
                locale={locale}
              />
            </div>
          </Panel>
        ) : null}
      </div>
    </Columns>
  );
}

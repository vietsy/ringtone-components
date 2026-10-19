import { ApprovalPair, Banner, PageHeader, Panel, Skeleton, Toast, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ActConfirm } from "@/features/public/ActConfirm";
import { editVersionAct, withdrawVersionAct } from "@/features/public/console-actions";
import { day, decides, documentTitle, drafts, moment, pubTranslator, refusalWords, typedText, versionState, versionTitle, type PolicyAttempt } from "@/features/public/console";
import { besideField, VersionEditor } from "@/features/public/VersionEditor";
import { readForPage } from "@/lib/api/flash";
import { loadDocumentVersion, type VersionDetail } from "@/lib/api/public";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { POLICY_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "pub15-edit";

/**
 * SCR-PUB-15 Version editor, for a version that exists. Its author edits a draft, saves it and submits it with the
 * instant it takes effect; the text is frozen from then on and every other reader sees the version read only. A draft
 * is withdrawn by its author or by an approver of its class; a published version not yet in effect by an approver of
 * its class who is not its author, so for the author the act stays on the page, refused with the rule. A version an
 * approver returned says who returned it and why.
 */
export default async function VersionEditorPage({ params, searchParams }: { params: Promise<{ version: string }>; searchParams: Promise<SearchParams> }) {
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
  const refusal = attempt?.refusal ?? null;
  const editable = version !== null && version.status === "DRAFT" && version.reader.isAuthor && drafts(version.reader, version.documentClass);

  return (
    <OpsFrame console="policy" current="documents" staff={staff} searchLabel={t("pubc.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("pubc.policy") }, { label: t("pubc.docs"), href: routes.policyDocuments() }]}
          title={version !== null ? versionTitle(version.kind, version.label, t) : t("pubc.docs")}
          {...(version !== null ? { status: versionState(version, t), meta: metaOf(version, t, locale) } : {})}
          locale={locale}
        />
        <Outcome attempt={attempt} version={version} t={t} locale={locale} />
        {refusal !== null && !besideField(refusal) ? (
          <Banner family="attention" title={refusalWords(refusal, t).title} code={refusal.code} live density="console" locale={locale}>
            {refusalWords(refusal, t).text}
          </Banner>
        ) : null}
        {version !== null && version.status === "DRAFT" && version.lastDecision === "RETURN" && version.decidedBy !== null && version.decidedAt !== null ? (
          <Banner family="info" title={t("pub15.returnedTitle", { name: version.decidedBy, ts: moment(version.decidedAt, locale) })} density="console" locale={locale}>
            {t("pub15.returnedText", { reason: version.decisionReason ?? "" })}
          </Banner>
        ) : null}
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={2} density="console" locale={locale} />
            <Skeleton variant="text" rows={8} density="console" locale={locale} />
          </Panel>
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
        {version !== null ? (
          <VersionEditor
            formId={FORM}
            action={editVersionAct}
            hidden={{ version: version.id }}
            mode="version"
            editable={editable}
            values={{
              label: typedText(attempt, "version_label", version.label),
              effective: typedText(attempt, "effective_from", version.effectiveFrom ?? ""),
              body: version.body === null ? null : typedText(attempt, "body", version.body[locale]),
              sources: version.sourceKinds.map((kind) => ({ kind, ref: typedText(attempt, `source-${kind}`, version.sourceRefs.find((source) => source.kind === kind)?.ref ?? "") })),
            }}
            sourceKinds={version.sourceKinds}
            requiredSections={version.requiredSections}
            sectionKeys={version.sectionKeys}
            standing={version.standing}
            awaiting={version.awaiting}
            refusal={refusal}
            missing={attempt?.missing ?? null}
            startNote={null}
            reading={{ title: documentTitle(version.kind, t), sections: version.sections }}
            aside={<Aside version={version} attempt={attempt} t={t} locale={locale} />}
            t={t}
            locale={locale}
          />
        ) : null}
      </div>
    </OpsFrame>
  );
}

/** The header's line under the title: who drafted, submitted, published or withdrew it, and when. */
function metaOf(version: VersionDetail, t: Translate, locale: Locale): string {
  if (version.status === "WITHDRAWN" && version.withdrawnAt !== null) return t("pub15.metaWithdrawn", { ts: moment(version.withdrawnAt, locale), name: version.withdrawnBy ?? "" });
  if (version.status === "PUBLISHED") {
    return version.publishedAt !== null && version.decidedBy !== null
      ? t("pub15.metaPublished", { ts: moment(version.publishedAt, locale), name: version.decidedBy })
      : t("pub15.metaPublishedSeed", { date: day(version.effectiveFrom ?? version.savedAt, locale) });
  }
  if (version.status === "SUBMITTED" && version.submittedAt !== null) return t("pub15.metaSubmitted", { name: version.draftedBy ?? "", ts: moment(version.submittedAt, locale) });
  return version.savedAt.includes("T")
    ? t("pub15.metaSaved", { name: version.draftedBy ?? "", ts: moment(version.savedAt, locale) })
    : t("pub15.metaSavedDay", { name: version.draftedBy ?? "", date: day(version.savedAt, locale) });
}

/** What the act just done did, as a toast in place (created, saved, submitted, withdrawn). */
function Outcome({ attempt, version, t, locale }: { attempt: PolicyAttempt | null; version: VersionDetail | null; t: Translate; locale: Locale }) {
  if (attempt === null || attempt.refusal !== null || attempt.missing !== null || version === null) return null;
  const label = version.label;
  const toast =
    attempt.act === "create"
      ? { family: "positive" as const, title: t("pub15.createdTitle", { version: label }), text: null }
      : attempt.act === "save"
        ? { family: "positive" as const, title: t("pub15.savedTitle", { version: label }), text: null }
        : attempt.act === "submit"
          ? { family: "info" as const, title: t("pub15.submittedTitle", { version: label }), text: t(version.documentClass === "PAGE" ? "pub15.submittedPage" : "pub15.submittedLegal") }
          : attempt.act === "withdraw"
            ? { family: "neutral" as const, title: t("pub15.withdrawnTitle", { version: label }), text: t("pub15.withdrawnText", { reason: version.withdrawalReason ?? "" }) }
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

/**
 * The panels beside the editor that the version's state allows: who prepared and who decides it, once submitted; and
 * withdrawal, for a draft or for a published version not yet in effect.
 */
function Aside({ version, attempt, t, locale }: { version: VersionDetail; attempt: PolicyAttempt | null; t: Translate; locale: Locale }) {
  const { reader } = version;
  const page = version.documentClass === "PAGE";
  const doc = documentTitle(version.kind, t);
  const upcoming = version.status === "PUBLISHED" && version.phase === "UPCOMING";
  const draft = version.status === "DRAFT";
  const mayWithdrawDraft = draft && (reader.isAuthor || reader.approves.includes(version.documentClass));
  // A published version: its author sees the act refused with the rule; an approver of its class acts.
  const mayAskPublished = upcoming && (reader.isAuthor || decides(reader, version.documentClass));
  const current = version.standing.inEffect;
  const next = version.standing.upcoming.find((line) => line.id !== version.id) ?? null;
  const keeps =
    current === null
      ? ""
      : next !== null && next.effectiveFrom !== null
        ? t(page ? "pub15.keepsPageNext" : "pub15.keepsLegalNext", { current: current.label, next: next.label, date: day(next.effectiveFrom, locale) })
        : t(page ? "pub15.keepsPage" : "pub15.keepsLegal", { current: current.label });
  const sod = refusalWords({ code: "SEGREGATION_REQUIRED" }, t).title;
  return (
    <>
      {version.status !== "DRAFT" && version.status !== "WITHDRAWN" && version.draftedBy !== null ? (
        <ApprovalPair
          preparer={{ name: version.draftedBy, role: t(`pub16.rolePreparer${version.documentClass}`), ...(version.submittedAt !== null ? { at: version.submittedAt } : {}) }}
          approver={version.decidedBy !== null && version.decidedAt !== null ? { name: version.decidedBy, role: t(`pub16.roleApprover${version.documentClass}`), at: version.decidedAt } : null}
          {...(version.decidedBy === null ? { awaiting: t(page ? "pub15.awaitingPage" : "pub15.awaitingLegal") } : { decision: "approved" as const })}
          preparerLabel={t("pub16.preparerLabel")}
          approverLabel={t("pub16.approverLabel")}
          locale={locale}
        />
      ) : null}
      {mayWithdrawDraft || mayAskPublished ? (
        <Panel as="aside" title={t("pub15.withdrawTitle")} description={t(upcoming ? "pub15.withdrawPublishedNote" : "pub15.withdrawNote")} level={2} density="console" locale={locale}>
          <div>
            <ActConfirm
              action={withdrawVersionAct}
              fields={{ version: version.id, label: version.label, from: "editor" }}
              label={t("pub15.withdraw")}
              icon="x"
              {...(upcoming && reader.isAuthor ? { disabledReason: sod } : {})}
              dialog={{
                title: t(page ? "pub15.dlgTitlePage" : "pub15.dlgTitleLegal", { version: version.label, doc }),
                description: upcoming
                  ? t("pub15.dlgPublished", { ts: moment(version.effectiveFrom ?? "", locale) })
                  : [t("pub15.dlgDraft", { version: version.label }), keeps].filter((part) => part !== "").join(" "),
                confirm: t("pub15.dlgYes", { version: version.label }),
                confirmVariant: "danger",
                back: t("pubc.cancel"),
              }}
              reason={{ label: t("pub15.reason"), helper: t("pub15.reasonHelp"), value: attempt?.act === "withdraw" && typeof attempt.typed.reason === "string" ? attempt.typed.reason : "" }}
              locale={locale}
            />
          </div>
        </Panel>
      ) : null}
    </>
  );
}

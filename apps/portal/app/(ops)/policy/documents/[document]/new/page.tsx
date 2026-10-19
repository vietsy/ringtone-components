import { Banner, PageHeader, Panel, Skeleton, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { createVersionAct } from "@/features/public/console-actions";
import { documentTitle, drafts, pubTranslator, refusalWords, type PolicyAttempt } from "@/features/public/console";
import { besideField, VersionEditor } from "@/features/public/VersionEditor";
import { readForPage } from "@/lib/api/flash";
import { loadNewVersionForm, type SourceRef } from "@/lib/api/public";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { POLICY_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "pub15-new";

/**
 * SCR-PUB-15 opened from "Soạn phiên bản mới": nothing exists yet, so nothing is read but the document. The form starts
 * from the latest published text and the next label, and "Tạo phiên bản" drafts it (`POST /documents/{id}/versions`);
 * the editor then opens on the new draft. A refusal comes back here with what was typed: DRAFT_EXISTS with the open
 * version to open instead.
 */
export default async function NewVersionPage({ params, searchParams }: { params: Promise<{ document: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-OPS");
  const [{ document }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = pubTranslator(locale);
  const view = reviewView(query, POLICY_VIEWS);
  const kept = readForPage<PolicyAttempt>(query);
  const attempt = kept !== null && kept.on === `new:${document}` ? kept : null;
  const outcome = view === "loading" ? null : await loadNewVersionForm(staff, document, view);
  const form = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // Only the author role of the document's class drafts it (PERM-864); anyone else is refused the form, not shown it.
  const refused = failure?.code === "NOT_AUTHORISED" || failure?.code === "DOCUMENT_NOT_FOUND" ? failure.code : form !== null && !drafts(form.reader, form.documentClass) ? "NOT_AUTHORISED" : null;
  const refusal = attempt?.refusal ?? null;
  const typed = attempt?.typed ?? {};
  const text = (name: string, fallback: string) => {
    const value = typed[name];
    return typeof value === "string" ? value : fallback;
  };
  const sources: SourceRef[] =
    form?.sourceKinds.map((kind) => ({ kind, ref: text(`source-${kind}`, "") })) ?? [];
  const title = form !== null ? t("pub15.titleNew", { doc: documentTitle(form.kind, t) }) : t("pubc.docs");

  return (
    <OpsFrame console="policy" current="documents" staff={staff} searchLabel={t("pubc.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("pubc.policy") }, { label: t("pubc.docs"), href: routes.policyDocuments() }]}
          title={title}
          {...(form !== null && refused === null ? { meta: t("pub15.metaNew") } : {})}
          locale={locale}
        />
        {refusal !== null && !besideField(refusal) ? (
          <Banner
            family="attention"
            title={refusalWords(refusal, t).title}
            code={refusal.code}
            {...(refusal.code === "DRAFT_EXISTS" && refusal.values.id !== undefined
              ? { action: { label: t("pub15.openExisting", { version: refusal.values.version ?? "" }), href: routes.policyVersion(refusal.values.id), variant: "secondary" as const } }
              : {})}
            live
            density="console"
            locale={locale}
          >
            {refusalWords(refusal, t).text}
          </Banner>
        ) : null}
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={2} density="console" locale={locale} />
            <Skeleton variant="text" rows={8} density="console" locale={locale} />
          </Panel>
        ) : null}
        {refused !== null ? (
          <ViewState
            view="refused"
            refusal={{ code: refused, title: refusalWords({ code: refused }, t).title, text: refusalWords({ code: refused }, t).text ?? "", family: "attention" }}
            level={2}
            density="console"
            locale={locale}
          />
        ) : failure !== null ? (
          <ViewState view="error" errorTitle={t("pubc.errTitle")} errorText={t("pubc.errText")} {...(failure.traceId !== null ? { traceId: failure.traceId } : {})} retryable={failure.retryable} level={2} density="console" locale={locale} />
        ) : form !== null ? (
          <VersionEditor
            formId={FORM}
            action={createVersionAct}
            hidden={{ document: form.kind }}
            mode="new"
            editable
            values={{ label: text("version_label", form.suggestedLabel), effective: "", body: text("body", form.startFrom?.body.vi ?? ""), sources }}
            sourceKinds={form.sourceKinds}
            requiredSections={form.requiredSections}
            sectionKeys={form.startFrom?.sectionKeys ?? []}
            standing={form.standing}
            awaiting={form.awaiting}
            refusal={refusal}
            missing={attempt?.missing ?? null}
            startNote={form.startFrom !== null ? t("pub15.startFrom", { version: form.startFrom.label }) : null}
            t={t}
            locale={locale}
          />
        ) : null}
      </div>
    </OpsFrame>
  );
}

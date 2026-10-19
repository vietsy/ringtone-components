import { Banner, FactList, PageHeader, Panel, Skeleton } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { EvidenceRequestFields } from "@/features/registration/EvidenceRequestFields";
import { codeStatus, day, inLine, layerWords, refusal, regOpsTranslator, reviewTypeWords } from "@/features/registration/console-copy";
import { requestEvidence } from "@/features/registration/review-actions";
import { readForPage } from "@/lib/api/flash";
import { loadEvidenceRequestForm, type EvidenceRequestAttempt, type EvidenceRequestForm } from "@/lib/api/registration-review";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG11_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "request-evidence";
/** CFG-328: the evidence response period, in days. */
const RESPONSE_DAYS = 14;

/**
 * SCR-REG-11 Request evidence. The officer asks the applicant for each item still needed to decide, with one due
 * date, so the application waits for them and the review period starts again when they arrive. A refusal of the
 * state the application is in is said above the actions, with the items kept.
 */
export default async function RequestEvidencePage({ params, searchParams }: { params: Promise<{ application: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const [{ application }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG11_VIEWS);
  const outcome = asked === "loading" ? null : await loadEvidenceRequestForm(staff, application, reviewViewOf("11", asked));
  const form = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const last = readForPage<EvidenceRequestAttempt>(query);
  const attempt = last?.page === "evidence-request" && last.application === application ? last : null;

  return (
    <OpsFrame console="operations" current="registration" staff={staff} searchLabel={t("regops.search")} keyMap={[{ keys: ["Esc"], label: t("regops.keyEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("regops.area") },
            { label: t("regops.queue"), href: routes.opsRegistration() },
            { label: t("regops.caseFile", { r: application }), href: routes.opsApplication(application) },
          ]}
          title={form !== null ? t("reg11.title", { r: form.reference }) : t("reg11.titleGeneric")}
          {...(form !== null ? { status: codeStatus(form.status), meta: meta(form, t, locale) } : {})}
          locale={locale}
        />
        {asked === "loading" ? (
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <Panel>
              <Skeleton variant="card" rows={7} density="console" />
            </Panel>
          </div>
        ) : null}
        {failure !== null ? <ConsoleFailure failure={failure} screen="reg11" t={t} locale={locale} /> : null}
        {form !== null ? <Request form={form} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function meta(form: EvidenceRequestForm, t: Translate, locale: Locale): string {
  const type = reviewTypeWords(form.reviewType, t);
  if (form.completeOn === null || form.expectedOn === null) return t("reg11.metaPlain", { p: form.premises.name, type });
  const values = { p: form.premises.name, type, c: day(form.completeOn, locale), e: day(form.expectedOn, locale) };
  const claim = form.claimUnderReview;
  return claim !== null
    ? t("reg11.metaClaim", { ...values, claim: t(`reg11.claim.${claim.kind}`, { layer: inLine(layerWords(claim.layer, t), locale) }) })
    : t("reg11.meta", values);
}

function Request({ form, attempt, t, locale }: { form: EvidenceRequestForm; attempt: EvidenceRequestAttempt | null; t: Translate; locale: Locale }) {
  const due = day(form.dueOn, locale);
  // A refusal of the attempt, or of the state the application is in now, sits above the actions with the items kept.
  const code = attempt !== null && attempt.code !== "EVIDENCE_ITEMS_EMPTY" ? attempt.code : form.blocked;
  const shown = code !== null && code !== "DRAFT" ? refusal(t, code, "reg11") : null;
  return (
    <div style={{ maxWidth: "var(--container-3xl)" }}>
      <form id={FORM} action={requestEvidence.bind(null, form.reference)} noValidate>
        <Panel gap="xl" locale={locale}>
          <EvidenceRequestFields
            formId={FORM}
            initial={attempt?.items ?? []}
            error={attempt?.code === "EVIDENCE_ITEMS_EMPTY" ? refusal(t, "EVIDENCE_ITEMS_EMPTY").text : null}
            cancelHref={routes.opsApplication(form.reference)}
            words={{
              items: t("reg11.items"),
              itemsHelp: t("reg11.itemsHelp"),
              item: t("reg11.item", { n: "{n}" }),
              code: t("reg11.code"),
              desc: t("reg11.desc"),
              add: t("reg11.add"),
              request: t("reg11.request", { n: "{n}" }),
              requestNone: t("reg11.requestNone"),
              requestWhy: t("reg11.requestWhy"),
              cancel: t("regops.cancel"),
              dlgTitle: t("reg11.dlgTitle", { n: "{n}", d: due }),
              dlgText: t("reg11.dlgText"),
              dlgBack: t("regops.back"),
            }}
            between={
              <>
                <Panel variant="plain" level={2} title={t("reg11.whatTitle")} compact locale={locale}>
                  <FactList
                    items={[{ label: t("reg11.due"), value: form.dueOn, kind: "date", note: t("reg11.dueNote", { n: String(RESPONSE_DAYS), v: String(form.responseVersion) }) }]}
                    density="console"
                    locale={locale}
                  />
                  <Text size="sm">{t("reg11.what1")}</Text>
                  <Text size="sm">{t("reg11.what2")}</Text>
                  <Text size="sm">{t("reg11.what3", { d: due })}</Text>
                </Panel>
                {shown !== null ? (
                  <Banner family="attention" title={shown.title} code={shown.code} compact density="console" live locale={locale}>
                    {shown.text}
                  </Banner>
                ) : null}
              </>
            }
            locale={locale}
          />
        </Panel>
      </form>
    </div>
  );
}

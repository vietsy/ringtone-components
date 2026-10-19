import { Banner, Button, ButtonRow, PageHeader, Panel, Skeleton } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { proposeCorrectionAct } from "@/features/engagement/actions";
import { engTranslator } from "@/features/engagement/copy";
import { CorrectionFields } from "@/features/engagement/CorrectionFields";
import { EventBlock } from "@/features/engagement/EventBlock";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { readForPage } from "@/lib/api/flash";
import { CORRECTION_GROUNDS, loadCorrectionDraft, type CorrectionDraftView, type EngagementAttempt } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/**
 * SCR-ENG-09 Correct a ledger event, before a proposal. Reached from SCR-ENG-10 only, with the support read in the
 * address: the event being corrected with its date, action, value and participant, the balance, the ground from
 * `CFG-65`'s set and the delta with the resulting balance computed beside it before anything is sent. No board or
 * Figma frame draws it: it is built from ENG's specification and wireframe.
 */
export default async function ProposeCorrectionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const read = text(params.read);
  const eventId = text(params.event);
  const outcome = view === "loading" ? null : await loadCorrectionDraft(staff, read, eventId, view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept?.page === "eng09" ? kept : null;
  const back = read !== "" ? routes.opsEngagementSupport({ read, event: eventId }) : routes.opsEngagementSupport();

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("engHome.title"), href: routes.opsEngagement() },
            { label: t("eng10.title"), href: back },
          ]}
          title={t("eng09.title")}
          locale={locale}
        />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={4} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng09.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {outcome?.data ? <Propose data={outcome.data} attempt={attempt} back={back} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Propose({ data, attempt, back, t, locale }: { data: CorrectionDraftView; attempt: EngagementAttempt | null; back: ReturnType<typeof routes.opsEngagementSupport>; t: Translate; locale: Locale }) {
  const { event } = data;
  const refusal = attempt?.refusal ?? null;
  const field = refusal?.code === "FIELD_MISSING" ? String(refusal.values.field ?? "") : null;
  const groundRefused = refusal?.code === "CORRECTION_GROUND_NOT_APPROVED";
  const blocked = !data.mayPropose ? t("eng09.withheld") : event.correctedBy !== null ? t("eng.refusal.CORRECTION_TARGET_ALREADY_CORRECTED.title") : null;
  return (
    <>
      {refusal !== null && field === null && !groundRefused ? <RefusalBanner refusal={refusal} t={t} locale={locale} density="console" /> : null}
      {!data.mayPropose ? (
        <Banner family="info" title={t("eng09.withheld")} density="console" locale={locale}>
          {t("eng08.withheldText")}
        </Banner>
      ) : null}
      <EventBlock data={data} t={t} locale={locale} />
      <Panel title={t("eng09.proposeTitle")} level={2} density="console" locale={locale}>
        <form id="eng09-propose" action={proposeCorrectionAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <input type="hidden" name="read" value={data.read} />
          <input type="hidden" name="event" value={event.id} />
          <CorrectionFields
            balance={data.balance}
            grounds={CORRECTION_GROUNDS.map((ground) => ({ value: ground, label: t(`eng.ground.${ground}`) }))}
            copy={{
              ground: t("eng09.ground"),
              groundHelp: t("eng09.groundHelp"),
              groundPick: t("eng09.groundPick"),
              delta: t("eng09.delta"),
              deltaHelp: t("eng09.deltaHelp"),
              resulting: t("eng09.resulting"),
              resultingNegative: t("eng09.resultingNegative"),
              noDelta: t("eng09.noDelta"),
            }}
            initial={{ ground: attempt?.form.ground ?? "", delta: attempt?.form.point_delta ?? "" }}
            errors={{
              ground: groundRefused ? t("eng.refusal.CORRECTION_GROUND_NOT_APPROVED.title") : null,
              delta: field === "point_delta" ? t("eng09.deltaMissing") : null,
            }}
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("eng09.never")}
          </Text>
          <Text size="sm" tone="secondary">
            {t("eng09.secondPerson")}
          </Text>
          <ButtonRow align="between">
            <Button variant="secondary" size="sm" icon="arrow-left" href={back} locale={locale}>
              {t("eng09.back")}
            </Button>
            <Button type="submit" variant="primary" size="sm" {...(blocked !== null ? { disabled: true, disabledReason: blocked } : {})} locale={locale}>
              {t("eng09.propose")}
            </Button>
          </ButtonRow>
        </form>
      </Panel>
    </>
  );
}

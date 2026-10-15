import { redirect } from "next/navigation";
import { Banner, Button, ButtonRow, ChoiceList, DateField, FactList, PageHeader, Panel, Skeleton, StatusLine, TextField } from "@/components/r1";
import { Text } from "@/components/Text";
import { startInspection } from "@/features/inspection/actions";
import { FieldFailure, FieldFrame } from "@/features/inspection/FieldFrame";
import { IntentButtons } from "@/features/inspection/IntentButtons";
import { ObservedFields } from "@/features/inspection/ObservedFields";
import { joined, premisesAt, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import {
  PURPOSES,
  currentFieldDevice,
  loadInspectionStart,
  type InspectionStart,
  type RefusalCode,
  type StartAttempt,
} from "@/lib/api/inspection";
import { readForPage } from "@/lib/api/flash";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER03_VIEWS } from "@/lib/mock/inspection";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const NO_ACTS: readonly RefusalCode[] = ["NO_EFFECTIVE_APPOINTMENT", "APPOINTMENT_SUSPENDED"];
const RETRYABLE: readonly RefusalCode[] = ["PREMISES_READ_UNAVAILABLE", "POLICY_READ_UNAVAILABLE"];

/**
 * SCR-VER-03 Start an inspection. The premises, the answer and the appointment come from the verification carried
 * in from SCR-VER-02; the inspector names the purpose, the basis and when the inspection took place, before
 * anything about it is recorded. Every inspection starts from a verification, so with nothing carried in the
 * inspector is taken to SCR-VER-01.
 */
export default async function StartInspectionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Signed in as an inspector, or sent to sign in.
  const { sessionId } = await requireInspector();
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, VER03_VIEWS);
  const attempt = readForPage<StartAttempt>(params);
  const outcome = view === "loading" ? null : await loadInspectionStart(sessionId, view, attempt);
  if (outcome?.failure?.code === "NOTHING_CARRIED") redirect(routes.fieldScan());
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <FieldFrame device={data?.device ?? currentFieldDevice()} locale={locale}>
      <PageHeader title={t("ver03.title")} size="public" locale={locale} />
      {failure !== null ? (
        <FieldFailure failure={failure} refusals={["NOT_AUTHORISED"]} t={t} locale={locale} />
      ) : (
        <Start data={data} t={t} locale={locale} />
      )}
    </FieldFrame>
  );
}

function Start({ data, t, locale }: { data: InspectionStart | null; t: Translate; locale: Locale }) {
  const refusal = data?.refusal ?? null;
  const readAt = data?.device.readAt ?? null;
  const offline = data?.device.network === "offline";
  const answerRefusal = data?.answerRefusal ?? null;
  const openInspection = data?.openInspection ?? null;
  const cursor = data?.openInspectionsRefusal ?? null;
  const draft = data?.draft ?? null;
  const observedRefusal = draft?.observedRefusal ?? null;
  const pastEnd = data?.pastAppointmentEnd === true;
  const startWhy =
    openInspection !== null
      ? t("ver03.openExists")
      : offline
        ? t("ver03.offlineWhy")
        : refusal !== null && NO_ACTS.includes(refusal)
          ? refusalOf(t, refusal).title
          : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      {offline && (
        <StatusLine
          family="info"
          text={t("ver.noNetworkTitle")}
          detail={`${t("ver.noNetwork")} ${readAt !== null ? t("ver.readAt", { t: timestamp(readAt, locale) }) : ""}`.trim()}
          locale={locale}
        />
      )}
      {refusal !== null && (
        <Banner
          family="attention"
          title={refusalOf(t, refusal).title}
          code={refusal}
          {...(RETRYABLE.includes(refusal)
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.fieldStartInspection() } }
            : {})}
          density="portal"
          locale={locale}
        >
          {refusalOf(t, refusal).text}
        </Banner>
      )}

      <Panel inset="sm" density="portal" locale={locale}>
        {data === null ? (
          <Skeleton variant="facts" rows={3} density="portal" locale={locale} />
        ) : (
          <FactList
            items={[
              { label: t("ver03.premises"), value: premisesAt(t, data.premises) },
              { label: t("ver03.answer"), value: data.answer, kind: "id" },
              { label: t("ver03.acting"), value: data.appointment.authority },
            ]}
            locale={locale}
          />
        )}
      </Panel>
      {answerRefusal !== null && (
        <Banner family="attention" title={refusalOf(t, answerRefusal).title} code={answerRefusal} density="portal" locale={locale}>
          {refusalOf(t, answerRefusal).text}
        </Banner>
      )}

      <form action={startInspection} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
        {/* What Continue needs: the inspection already open and the answer to attach to it. */}
        {data !== null && <input type="hidden" name="answer" value={data.answer} />}
        {openInspection !== null && <input type="hidden" name="open_inspection" value={openInspection} />}
        <Panel inset="sm" gap="lg" density="portal" locale={locale}>
          <ChoiceList
            legend={t("ver03.purpose")}
            name="purpose"
            options={PURPOSES.map((purpose) => ({ value: purpose, label: t(`ver.purpose.${purpose}`) }))}
            value={draft?.purpose ?? "ROUTINE"}
            required
            density="portal"
            locale={locale}
          />
          <TextField
            label={t("ver03.basis")}
            name="inspection_basis_ref"
            value={draft?.basis ?? ""}
            maxLength={200}
            wrap
            density="portal"
            locale={locale}
          />
          {draft !== null ? (
            <ObservedFields
              observed={{
                label: t("ver03.tookPlace"),
                on: draft.observedOn,
                time: draft.observedTime,
                error: observedRefusal !== null ? refusalSentence(t, observedRefusal) : null,
              }}
              delay={{
                label: t("ver03.delay"),
                value: draft.delayReason,
                error: draft.delayRefusal !== null ? refusalSentence(t, draft.delayRefusal) : null,
              }}
              late={draft.delayReasonRequired}
              locale={locale}
            />
          ) : (
            <DateField label={t("ver03.tookPlace")} name="observed_at" withTime required density="premises" locale={locale} />
          )}
          {data !== null && (
            <Text size="sm" tone="secondary">
              {t("ver03.jurisdiction", { authority: data.appointment.authorityCode, areas: joined(t, data.appointment.areas) })}
            </Text>
          )}
        </Panel>

        {cursor !== null && (
          <Banner family="attention" title={t("ver.cursorTitle")} code={cursor} density="portal" locale={locale}>
            {t("ver.cursorText")}
          </Banner>
        )}

        <ButtonRow>
          <IntentButtons
            buttons={[
              ...(openInspection !== null
                ? [
                    {
                      intent: "continue",
                      label: t("ver03.continue"),
                      variant: "primary" as const,
                      size: "lg" as const,
                      icon: "arrow-right",
                      ...(offline ? { disabledReason: t("ver03.offlineWhy") } : {}),
                    },
                  ]
                : []),
              {
                intent: "start",
                label: t("ver03.start"),
                variant: openInspection !== null || answerRefusal !== null ? ("secondary" as const) : ("primary" as const),
                size: "lg" as const,
                ...(startWhy !== null ? { disabledReason: startWhy } : {}),
              },
              // Offered once the answer was refused as the inspection's evidence (design/03 SCR-VER-03).
              ...(answerRefusal !== null
                ? [
                    {
                      intent: "without",
                      label: t("ver03.without"),
                      variant: pastEnd ? ("secondary" as const) : ("primary" as const),
                      size: "lg" as const,
                      ...(pastEnd ? { disabledReason: t("ver03.lastDay") } : {}),
                    },
                  ]
                : []),
            ]}
            locale={locale}
          />
          <Button variant="quiet" size="md" fullWidth href={routes.field()} locale={locale}>
            {t("ver.cancel")}
          </Button>
        </ButtonRow>
      </form>
    </div>
  );
}

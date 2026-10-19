import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Columns, NumberedSteps, PageHeader, Panel, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { channelName, participationLine, subTranslator } from "@/features/submissions/copy";
import { SubmitRecordsForm, type SubmitCopy } from "@/features/submissions/SubmitRecordsForm";
import { readForPage } from "@/lib/api/flash";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { loadSubmitForm, reviewFor, type OrgReader, type SubmitAttempt, type SubmitFormPage } from "@/lib/api/submissions";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAT04_VIEWS } from "@/lib/mock/submissions";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-CAT-04 Submit records. The administrator chooses an agreed channel and its format and the records file;
 * the file is counted, the ceiling of 50,000 records is held, and Submit sends it. The reference is issued at
 * once, before any record is judged, and SCR-CAT-05 opens on the new submission, RECEIVED.
 *
 * Only an active participation submits. A suspended one reaches the form and finds it locked, with the board's
 * words; an organisation with no active participation finds it locked with PARTICIPATION_NOT_ACTIVE.
 */
export default async function SubmitRecordsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo)]);
  const t = subTranslator(locale);
  const view = reviewFor(cmo, params, CAT04_VIEWS);
  const kept = view === null ? readForPage<SubmitAttempt>(params) : null;
  const outcome = view === "loading" ? null : await loadSubmitForm(cmo, view, kept?.page === "submit" ? kept : null);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const reader: OrgReader = data?.reader ?? {
    organisationName: cmo.organisationName,
    account: cmo.account,
    participation: { reference: standing.reference, state: standing.state },
  };
  const state = reader.participation.state;
  const suspended = state === "SUSPENDED";
  const notActive = !suspended && state !== "ACTIVE";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={orgNav("submit", standing.open, locale)}
      account={reader.account}
      context={orgContext(reader.organisationName, participationLine(t, reader.participation), locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("cat04.crumb") }]} title={t("cat04.title")} meta={t("cat04.meta")} locale={locale} />
        {suspended ? (
          <Banner family="danger" title={t("cat04.suspTitle")} density="portal" locale={locale}>
            {t("cat04.suspText")}
          </Banner>
        ) : null}
        {notActive ? (
          <Banner family="attention" title={t("sub.refusal.PARTICIPATION_NOT_ACTIVE")} code="PARTICIPATION_NOT_ACTIVE" density="portal" locale={locale}>
            {t("cat04.notActive")}
          </Banner>
        ) : null}
        <ViewState
          view={view === "loading" ? "loading" : failure !== null ? "error" : "populated"}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          {...(failure !== null ? { retryable: failure.retryable } : {})}
          errorText={t("cat04.errorText")}
          density="portal"
          rows={6}
          locale={locale}
        >
          {data !== null ? (
            <Columns single={phone}>
              <SubmitRecordsForm
                copy={submitCopy(t, data, locale)}
                channels={data.channels.map((channel) => ({
                  value: channel.code,
                  label: channel.agreed ? channelName(t, channel.code) : t("sub.channelNotAgreed", { channel: channelName(t, channel.code) }),
                  agreed: channel.agreed,
                  format: channel.format,
                }))}
                formats={[
                  { value: "json", label: t("sub.format.json") },
                  { value: "csv", label: t("sub.format.csv") },
                ]}
                ceiling={data.ceiling}
                entered={data.entered}
                sending={data.sending}
                drawn={view !== null}
                locked={suspended ? { reason: t("cat04.formOff") } : notActive ? { reason: t("cat04.notActive") } : null}
                cancelHref={routes.orgParticipation()}
                phone={phone}
                locale={locale}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                <Panel as="aside" density="portal" locale={locale}>
                  <NumberedSteps title={t("cat04.nextTitle")} level={2} steps={[t("cat04.s1"), t("cat04.s2"), t("cat04.s3")]} locale={locale} />
                </Panel>
              </div>
            </Columns>
          ) : null}
        </ViewState>
      </div>
    </PortalShell>
  );
}

/** The form's words; the ceiling and the agreed channels are filled here, the file's own figures in the form. */
function submitCopy(t: Translate, data: SubmitFormPage, locale: Locale): SubmitCopy {
  const ceiling = R1_FORMAT.formatCount(data.ceiling, locale) ?? "";
  const agreed = data.channels.filter((channel) => channel.agreed).map((channel) => t(`sub.channelInText.${channel.code}`));
  const field = (name: string) => t("sub.refusal.FIELD_MISSING", { field: t(`sub.field.${name}`) });
  return {
    channelTitle: t("cat04.channelTitle"),
    channel: t("cat04.channel"),
    channelHelp: t("cat04.channelHelp"),
    format: t("cat04.format"),
    formatHelp: t("cat04.formatHelp"),
    payloadTitle: t("cat04.payloadTitle"),
    file: t("cat04.file"),
    fileHelp: t("cat04.fileHelp", { ceiling }),
    countLabel: t("cat04.countLabel"),
    records: t("cat04.records"),
    ceilingLabel: t("cat04.ceilingLabel"),
    ceiling: t("cat04.ceiling", { ceiling }),
    submit: t("cat04.submit"),
    submitOne: t("cat04.submitOne"),
    submitAny: t("cat04.submitAny"),
    submitting: t("cat04.submitting"),
    submittingAny: t("cat04.submittingAny"),
    cancel: t("cat04.cancel"),
    stSend: t("cat04.stSend"),
    stSendDetail: t("cat04.stSendDetail"),
    stRef: t("cat04.stRef"),
    stRefDetail: t("cat04.stRefDetail"),
    noFile: t("cat04.noFile"),
    tooLarge: t("sub.refusal.PAYLOAD_TOO_LARGE"),
    chanRefused: t("sub.refusal.CHANNEL_NOT_AGREED", { list: agreed.join(", ") }),
    submitOffBig: t("cat04.submitOffBig", { ceiling }),
    submitOffChan: t("cat04.submitOffChan"),
    submitOffFile: t("cat04.submitOffFile"),
    sizeMb: t("sub.sizeMb"),
    sizeKb: t("sub.sizeKb"),
    missing: { channel: field("channel"), format: field("format"), file: field("file") },
  };
}

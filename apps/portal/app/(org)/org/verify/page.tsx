import { R1_FORMAT } from "@rightone/formatting";
import {
  Button,
  ButtonRow,
  Combobox,
  DateField,
  Divider,
  FactList,
  PageHeader,
  Panel,
  VerificationResult,
  ViewState,
} from "@/components/r1";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { PortalShell } from "@/components/shells/PortalShell";
import { Text } from "@/components/Text";
import { AnswerArea, AskButton, AskForm, NoAnswer } from "@/features/authorisation/AskForm";
import { askAboutAuthority } from "@/features/authorisation/actions";
import {
  loadVerifyAuthorisation,
  type AuthorityVerification,
  type VerifyAttempt,
  type VerifyAuthorisation,
} from "@/lib/api/authorisation";
import { readForPage } from "@/lib/api/flash";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { PTY17_VIEWS } from "@/lib/mock/authorisation";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pty.en.json";
import vi from "@/messages/screens/pty.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** Each answer in the family the board draws it in, with its lines after the first. */
const ANSWERS = {
  ANOTHER_AUTHORITY_EXISTS: { family: "attention", lines: ["pty17.another1", "pty17.another2", "pty17.another3"] },
  EFFECTIVE: { family: "positive", lines: ["pty17.yours1", "pty17.yours2"] },
  NOT_EFFECTIVE: { family: "neutral", lines: ["pty17.none1"] },
} as const;

/**
 * SCR-PTY-17 Verify an authorisation scope. A person of a collecting organisation asks whether an authority to
 * collect for a premises was in effect at a moment, and reads one of three answers, which never names another
 * holder; every answer is recorded with its time. New enquiry asks again. An organisation without an effective
 * participation is refused, and nothing about any premises is shared with it.
 */
export default async function VerifyAuthorisationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the question as the last enquiry left it.
  const view = reviewView(params, PTY17_VIEWS);
  const outcome = await loadVerifyAuthorisation(cmo, standing.active, view, readForPage<VerifyAttempt>(params));
  const trace = outcome.failure?.traceId ?? null;
  const line = standing.reference !== null ? t("pty.ptc", { reference: standing.reference }) : t("pty.noPtc");

  return (
    <PortalShell
      fill
      layout={frame === "phone" ? "phone" : "desktop"}
      nav={orgNav("verify", standing.open, locale)}
      account={cmo.account}
      context={orgContext(cmo.organisationName, line, locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("pty17.title")} meta={t("pty17.meta")} locale={locale} />
        <div style={{ maxWidth: "var(--container-4xl)" }}>
          {outcome.data !== null ? (
            <Enquiry data={outcome.data} t={t} locale={locale} />
          ) : (
            <ViewState
              view="error"
              errorTitle={t("pty17.errTitle")}
              errorText={t("pty17.errText")}
              {...(trace !== null ? { traceId: trace } : {})}
              retryable={outcome.failure?.retryable ?? true}
              density="portal"
              locale={locale}
            />
          )}
        </div>
      </div>
    </PortalShell>
  );
}

function Enquiry({ data, t, locale }: { data: VerifyAuthorisation; t: Translate; locale: Locale }) {
  // NOT_A_REGISTERED_COLLECTING_ORGANISATION replaces the question: no premises is offered or named (@AC-FR-PTY-047-04).
  if (!data.registered) {
    return <ViewState view="refused" refusal={{ title: t("pty17.nrTitle"), text: t("pty17.nrText"), family: "neutral" }} density="portal" locale={locale} />;
  }
  if (data.result.kind === "answered") return <Answered verification={data.result.verification} t={t} locale={locale} />;

  const { question, result } = data;
  const refused = result.kind === "refused" ? result : null;
  const options = data.register.map((premises) => ({
    value: premises.reference,
    label: premises.name,
    detail: t("pty17.premisesDetail", { reference: premises.reference, ward: premises.ward }),
  }));
  const future = refused?.code === "INSTANT_IN_FUTURE" ? refused : null;

  return (
    <AskForm action={askAboutAuthority} initiallyComplete={question.premises !== "" && question.date !== "" && question.time !== ""}>
      <Panel gap="xl" density="portal" locale={locale}>
        <Panel variant="plain" title={t("pty17.qTitle")} density="portal" locale={locale}>
          <Combobox
            wrap
            label={t("pty17.premises")}
            helper={t("pty17.premisesHelp")}
            name="premises_id"
            options={options}
            {...(question.premises !== "" ? { value: question.premises } : {})}
            placeholder={t("pty17.premisesPlaceholder")}
            {...(refused?.code === "PREMISES_NOT_FOUND" ? { error: t("pty17.notFound") } : {})}
            allowCustom
            required
            density="org"
            width="var(--container-lg)"
            locale={locale}
          />
          {/* INSTANT_IN_FUTURE is the time field's error, and its next step replaces the helper while it stands. */}
          <DateField
            label={t("pty17.at")}
            helper={future !== null ? t("pty17.atHelpNow", { now: R1_FORMAT.formatTimestamp(future.requestedAt, locale) ?? "" }) : t("pty17.atHelp")}
            name="at"
            value={question.date}
            time={question.time}
            withTime
            max={data.today}
            {...(future !== null ? { error: t("pty17.future") } : {})}
            required
            density="org"
            width="var(--container-lg)"
            locale={locale}
          />
        </Panel>

        <AnswerArea title={t("pty17.aTitle")} checkingText={t("pty17.checking")} checking={result.kind === "checking"} locale={locale}>
          {result.kind === "unavailable" || result.kind === "failed" ? (
            <>
              <Divider />
              <Panel variant="plain" title={t("pty17.aTitle")} density="portal" locale={locale}>
                {result.kind === "unavailable" ? (
                  <ViewState view="refused" refusal={{ title: t("pty17.unTitle"), text: t("pty17.unText"), family: "neutral" }} density="portal" locale={locale} />
                ) : (
                  <NoAnswer title={t("pty17.errTitle")} text={t("pty17.errText")} traceId={result.traceId} locale={locale} />
                )}
              </Panel>
            </>
          ) : null}
        </AnswerArea>

        <Divider />
        <ButtonRow>
          {/* The board offers no Ask once the register has failed to answer: only the way out. */}
          {result.kind !== "failed" ? (
            <AskButton label={t("pty17.ask")} loadingLabel={t("pty17.asking")} reason={t("pty17.askWhy")} pending={result.kind === "checking"} locale={locale} />
          ) : null}
          <Button variant="quiet" size="md" href={routes.org()} locale={locale}>
            {t("pty17.close")}
          </Button>
        </ButtonRow>
      </Panel>
    </AskForm>
  );
}

/** The question as it was asked, the answer in its family, and the moment the read was recorded. */
function Answered({ verification, t, locale }: { verification: AuthorityVerification; t: Translate; locale: Locale }) {
  const { premises, at, answer, period, readAt } = verification;
  const shape = ANSWERS[answer];
  const dates = period !== null ? { from: R1_FORMAT.formatDate(period.from, locale) ?? "", to: R1_FORMAT.formatDate(period.to, locale) ?? "" } : {};
  const [first = "", ...more] = shape.lines.map((key) => t(key, dates));

  return (
    <Panel gap="xl" density="portal" locale={locale}>
      <Panel variant="plain" title={t("pty17.qTitle")} density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("pty17.fPremises"), value: premises.name, note: t("pty17.premisesDetail", { reference: premises.reference, ward: premises.ward }) },
            { label: t("pty17.fAt"), value: R1_FORMAT.formatTimestamp(at, locale) },
          ]}
          density="portal"
          locale={locale}
        />
      </Panel>
      <Divider />
      <Panel variant="plain" title={t("pty17.aTitle")} density="portal" locale={locale}>
        <VerificationResult result="answer" family={shape.family} title={first} recordedAt={readAt} recordedLabel={t("pty17.recordedLabel")} locale={locale}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              {more.map((text) => (
                <Text key={text} size="base">
                  {text}
                </Text>
              ))}
            </div>
            <Text size="sm" tone="secondary">
              {t("pty17.wrong")}
            </Text>
          </div>
        </VerificationResult>
      </Panel>
      <Divider />
      <ButtonRow>
        {/* New enquiry clears this screen and asks again (PTY 03). */}
        <Button variant="primary" size="md" href={routes.orgVerify()} locale={locale}>
          {t("pty17.again")}
        </Button>
        <Button variant="quiet" size="md" href={routes.org()} locale={locale}>
          {t("pty17.close")}
        </Button>
      </ButtonRow>
    </Panel>
  );
}

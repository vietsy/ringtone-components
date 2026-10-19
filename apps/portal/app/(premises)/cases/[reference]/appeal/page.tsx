import { Banner, Button, ButtonRow, Checkbox, ChoiceList, DateField, FactList, PageHeader, Panel, Skeleton, TextField, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { PublicShell } from "@/components/shells/PublicShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { askReopening, lodgeAppeal } from "@/features/cases/actions";
import { casTranslator, day, readerOf } from "@/features/cases/copy";
import { isoDate } from "@/features/cases/dates";
import { RequiredForm, RequiredSubmit } from "@/features/cases/RequiredForm";
import { loadAppealForm, type AppealForm, type ConsoleAttempt } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { currentPrincipal, currentWorld } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAS08_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

const REQUIRED = ["grounds", "appellant_contact"] as const;
const REOPEN_REQUIRED = ["ground_ref", "evidence_date"] as const;

/**
 * SCR-CAS-08 Lodge an appeal, reached from the decision on SCR-CAS-02 with the case reference alone, like the case
 * itself. The decision and the date it gave for a challenge sit beside today's date, so the gap is visible; a
 * challenge after that date is still lodged and answered, and recorded late (DR-48 row 2), so the form stays and
 * says so rather than closing the door. Where the appeal is no longer the reader's route - the decision was
 * challenged already, or the case was closed without one - a closed case offers the reopening block instead: the
 * new evidence, the day it came to exist and what it would change. The two are never shown at once.
 */
export default async function LodgeAppealPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }) {
  // No guard turns a reader away: the reference, not the session, opens the case and its decision.
  const principal = await currentPrincipal();
  const [{ reference: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = casTranslator(locale);
  const view = reviewView(query, CAS08_VIEWS);
  const attempt = view === null ? readForPage<ConsoleAttempt>(query) : null;
  const kept = (attempt?.form === "appeal" || attempt?.form === "reopen") && attempt.subject === reference ? attempt : null;
  const key = principal?.sessionId ?? (await currentWorld());
  const outcome = view === "loading" ? null : await loadAppealForm(key, reference, readerOf(principal), view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0, maxWidth: phone ? "100%" : "var(--container-3xl)" }}>
      <PageHeader
        crumbs={[...(principal !== null ? [{ label: t("casMine.crumb"), href: routes.myCases() }] : []), { label: reference, href: routes.myCase(reference) }]}
        title={t("cas08.title", { ref: reference })}
        {...(principal === null ? { size: "public" as const } : {})}
        locale={locale}
      />
      {kept !== null && Object.keys(kept.refusal.fields).length === 0 && kept.refusal.code !== "REOPEN_WINDOW_CLOSED" ? (
        <Banner family="attention" title={t(`cas.refusal.${kept.refusal.code}.title`)} code={kept.refusal.code} live density="portal" locale={locale}>
          {t(`cas.refusal.${kept.refusal.code}.text`, {
            date: kept.refusal.detail.date !== undefined && kept.refusal.detail.date !== "" ? day(kept.refusal.detail.date, locale) : "",
            number: kept.refusal.detail.number ?? "",
            state: "",
            permitted: t("cas02.permitted"),
          })}
        </Banner>
      ) : null}
      {view === "loading" ? (
        <Panel inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={3} density="portal" locale={locale} />
        </Panel>
      ) : null}
      {failure !== null ? (
        failure.code === "CASE_NOT_FOUND" ? (
          <ViewState level={2} view="refused" refusal={{ code: "DECISION_NOT_FOUND", title: t("cas08.nfTitle"), text: t("cas.refusal.DECISION_NOT_FOUND.text"), family: "attention" }} density="portal" locale={locale} />
        ) : failure.code === "ROLE_OUT_OF_SCOPE" ? (
          // A case of the party the person's authority does not reach (PTY, DR-201): a delegate's of another premises.
          <ViewState level={2} view="refused" refusal={{ code: failure.code, title: t("cas.refusal.ROLE_OUT_OF_SCOPE.title"), text: t("cas.refusal.ROLE_OUT_OF_SCOPE.text"), family: "attention" }} density="portal" locale={locale} />
        ) : (
          <ViewState
            level={2}
            view="error"
            errorTitle={t("cas08.errTitle")}
            errorText={t("cas08.errText", { trace: failure.traceId ?? "" })}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="portal"
            locale={locale}
          />
        )
      ) : null}
      {data !== null ? <Appeal data={data} kept={kept} phone={phone} t={t} locale={locale} /> : null}
    </div>
  );

  if (principal === null) {
    return (
      <PublicShell fill locale={locale}>
        {body}
      </PublicShell>
    );
  }
  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={premisesNav("cases", frame, locale)} account={principal.account} locale={locale}>
      {body}
    </PortalShell>
  );
}

function Appeal({ data, kept, phone, t, locale }: { data: AppealForm; kept: ConsoleAttempt | null; phone: boolean; t: Translate; locale: Locale }) {
  const inset = phone ? "sm" : "md";
  const back = (
    <Button variant="quiet" size="md" href={routes.myCase(data.reference)} fullWidth={phone} locale={locale}>
      {t("cas08.back")}
    </Button>
  );
  const reopenKept = kept?.form === "reopen" ? kept : null;
  if (data.decision === null) {
    return (
      <>
        {data.reopen !== null ? (
          <Reopen data={data} kept={reopenKept} decided={false} phone={phone} t={t} locale={locale} />
        ) : (
          <ViewState level={2} view="refused" refusal={{ code: "NO_DECISION_TO_APPEAL", title: t("cas.refusal.NO_DECISION_TO_APPEAL.title"), text: t("cas.refusal.NO_DECISION_TO_APPEAL.text"), family: "info" }} density="portal" locale={locale} />
        )}
        <div>{back}</div>
      </>
    );
  }
  const late = data.decision.appealDeadline !== null && data.today > data.decision.appealDeadline;
  const typed = (name: string, fallback: string) => {
    const value = appealKept?.values[name];
    return typeof value === "string" ? value : fallback;
  };
  const appealKept = kept?.form === "appeal" ? kept : null;
  const missing = (field: string, label: string) => (appealKept?.refusal.fields[field] !== undefined ? { error: t("cas.refusal.FIELD_MISSING.text", { field: label }) } : {});
  const values = { grounds: typed("grounds", ""), appellant_contact: typed("appellant_contact", data.contact) };
  return (
    <>
      <Panel inset={inset} gap="md" density="portal" locale={locale}>
        <FactList
          columns={phone ? 1 : 2}
          items={[
            { label: t("cas08.issued"), value: data.decision.issuedAt, kind: "date" },
            { label: t("cas08.by"), value: data.decision.appealDeadline, kind: "date", note: t("cas08.today", { d: day(data.today, locale) }), missing: t("cas08.noDeadline") },
            { label: t("cas02.dRemedy"), value: t(`cas.remedy.${data.decision.remedy}`) },
            { label: t("cas02.dRoute"), value: data.decision.appealRoute },
          ]}
          density="portal"
          locale={locale}
        />
      </Panel>
      {data.open !== null ? (
        <Banner family="info" title={t("cas.refusal.APPEAL_ALREADY_LODGED.title")} code="APPEAL_ALREADY_LODGED" density="portal" locale={locale}>
          {data.open.dueAt !== null ? t("cas.refusal.APPEAL_ALREADY_LODGED.text", { date: day(data.open.dueAt, locale) }) : t("cas08.lodgedUnmeasured")}
        </Banner>
      ) : data.decided !== null ? (
        <>
          <Banner family="info" title={t(data.decided.outcome !== null ? "cas08.decidedTitle" : "cas08.lapsedTitle")} density="portal" locale={locale}>
            {data.decided.outcome !== null ? t("cas08.decidedText", { d: day(data.decided.outcome.decidedAt, locale) }) : t("cas.refusal.APPEAL_LAPSED.text")}
          </Banner>
          {data.reopen !== null ? <Reopen data={data} kept={reopenKept} decided phone={phone} t={t} locale={locale} /> : null}
        </>
      ) : (
        <RequiredForm action={lodgeAppeal.bind(null, data.reference)} required={REQUIRED} initiallyMissing={REQUIRED.filter((name) => values[name] === "")}>
          <Panel title={t("cas08.formTitle")} level={2} inset={inset} gap="md" density="portal" locale={locale}>
            {late ? (
              <Banner family="info" title={t("cas.refusal.APPEAL_LATE_RECORDED.title")} code="APPEAL_LATE_RECORDED" density="portal" locale={locale}>
                {t("cas.refusal.APPEAL_LATE_RECORDED.text")}
              </Banner>
            ) : null}
            <TextField
              label={t("cas08.grounds")}
              name="grounds"
              value={values.grounds}
              multiline
              rows={6}
              maxLength={4000}
              helper={t("cas08.groundsHelp")}
              required
              {...missing("grounds", t("cas08.groundsField"))}
              density="portal"
              locale={locale}
            />
            <TextField
              label={t("cas08.contact")}
              name="appellant_contact"
              value={values.appellant_contact}
              helper={t("cas08.contactHelp")}
              autoComplete="email"
              required
              {...missing("contact", t("cas01.contactField"))}
              density="portal"
              locale={locale}
            />
            <Text size="sm" tone="secondary">
              {t("cas08.what")}
            </Text>
            <ButtonRow align="between">
              {back}
              <RequiredSubmit
                variant="primary"
                size="md"
                fullWidth={phone}
                reasons={[
                  { field: "grounds", text: t("cas08.needGrounds") },
                  { field: "appellant_contact", text: t("cas01.giveContact") },
                ]}
                locale={locale}
              >
                {t("cas08.lodge")}
              </RequiredSubmit>
            </ButtonRow>
          </Panel>
        </RequiredForm>
      )}
      {data.open !== null ? <div>{back}</div> : null}
    </>
  );
}

/**
 * Ask for a reopening (SCR-CAS-08, POST /cases/{id}/reopenings by the raiser): the new evidence, the day it came to
 * exist, and what it would change over the outcomes the decision carried - naming nothing is an answer, leaving every
 * box empty is not. A proposal already waiting is said instead of the form, and a window that has closed replaces the
 * block with the date it closed and the support line.
 */
function Reopen({ data, kept, decided, phone, t, locale }: { data: AppealForm; kept: ConsoleAttempt | null; decided: boolean; phone: boolean; t: Translate; locale: Locale }) {
  const reopen = data.reopen;
  if (reopen === null) return null;
  const inset = phone ? "sm" : "md";
  if (reopen.waiting !== null && reopen.waiting.state === "REOPEN_PROPOSED") {
    return (
      <Banner family="info" title={t("cas08.waitingTitle")} density="portal" locale={locale}>
        {t("cas08.waitingText", { d: day(reopen.waiting.proposedAt, locale) })}
      </Banner>
    );
  }
  const closedOn = kept?.refusal.code === "REOPEN_WINDOW_CLOSED" ? (kept.refusal.detail.date ?? reopen.windowEnds) : reopen.windowEnds !== null && data.today > reopen.windowEnds ? reopen.windowEnds : null;
  if (closedOn !== null || reopen.windowEnds === null) {
    return (
      <ViewState
        level={2}
        view="refused"
        refusal={{
          code: "REOPEN_WINDOW_CLOSED",
          title: t("cas.refusal.REOPEN_WINDOW_CLOSED.title"),
          text: t("cas.refusal.REOPEN_WINDOW_CLOSED.text", { date: closedOn !== null && closedOn !== "" ? day(closedOn, locale) : "", number: data.supportLine }),
          family: "attention",
        }}
        density="portal"
        locale={locale}
      />
    );
  }
  const typed = (name: string): string => {
    const value = kept?.values[name];
    return typeof value === "string" ? value : "";
  };
  const chosen = (() => {
    const value = kept?.values.displaced_outcomes;
    return value === undefined ? [] : typeof value === "string" ? [value] : [...value];
  })();
  const refusal = kept?.refusal ?? null;
  const beside = (field: string, label: string): { error: string } | Record<string, never> => {
    const code = refusal?.fields[field];
    if (code === undefined || refusal === null) return {};
    if (code === "FIELD_MISSING") return { error: t("cas.refusal.FIELD_MISSING.text", { field: label }) };
    return { error: t(`cas.refusal.${code}.text`, { date: refusal.detail.date !== undefined && refusal.detail.date !== "" ? day(refusal.detail.date, locale) : "" }) };
  };
  return (
    <RequiredForm action={askReopening.bind(null, data.reference)} required={REOPEN_REQUIRED} initiallyMissing={REOPEN_REQUIRED.filter((name) => typed(name) === "")}>
      <Panel title={t("cas08.reopenTitle")} level={2} inset={inset} gap="md" density="portal" locale={locale}>
        <Text size="base" measure="2xl">
          {t(decided ? "cas08.reopenAboutDecided" : "cas08.reopenAbout")}
        </Text>
        <TextField
          label={t("cas08.newEvidence")}
          name="ground_ref"
          value={typed("ground_ref")}
          multiline
          rows={4}
          maxLength={500}
          helper={t("cas08.newEvidenceHelp")}
          required
          {...beside("groundRef", t("cas08.newEvidenceField"))}
          density="portal"
          locale={locale}
        />
        <DateField
          label={t("cas08.evidenceOn")}
          name="evidence_date"
          value={isoDate(typed("evidence_date"))}
          max={data.today}
          today={data.today}
          helper={t("cas08.evidenceOnHelp")}
          required
          {...beside("evidenceOn", t("cas08.evidenceOnField"))}
          density="portal"
          locale={locale}
        />
        <ChoiceList
          legend={t("cas08.displaces")}
          helper={t("cas08.displacesHelp")}
          name="displaced_outcomes"
          multiple
          options={reopen.outcomes.map((kind) => ({ value: kind, label: t(`cas.remedy.${kind}`) }))}
          value={chosen.filter((value) => value !== "nothing")}
          {...beside("displaced", t("cas08.displaces"))}
          density="portal"
          locale={locale}
        />
        <Checkbox label={t("cas08.nothing")} name="displaced_outcomes" value="nothing" checked={chosen.includes("nothing")} density="portal" locale={locale} />
        <Text size="sm" tone="secondary">
          {t("cas08.window", { d: day(reopen.windowEnds, locale) })} {t("cas08.reopenWhat")}
        </Text>
        <div>
          <RequiredSubmit
            variant="primary"
            size="md"
            fullWidth={phone}
            reasons={[
              { field: "ground_ref", text: t("cas08.needEvidence") },
              { field: "evidence_date", text: t("cas08.needEvidenceOn") },
            ]}
            locale={locale}
          >
            {t("cas08.ask")}
          </RequiredSubmit>
        </div>
      </Panel>
    </RequiredForm>
  );
}

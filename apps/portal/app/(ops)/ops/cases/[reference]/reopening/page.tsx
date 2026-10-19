import { Banner, Button, ButtonRow, Checkbox, ChoiceList, DateField, FactList, PageHeader, Panel, Skeleton, Table, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { authoriseReopening, proposeReopening, refuseReopening } from "@/features/cases/console-actions";
import { ConfirmSubmit } from "@/features/cases/ConfirmSubmit";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, fieldRefusal, opsStatus, refusalWords } from "@/features/cases/copy";
import { RequiredForm, RequiredSubmit } from "@/features/cases/RequiredForm";
import { isoDate } from "@/features/cases/dates";
import { GROUND_KINDS, loadReopeningPage, type ConsoleAttempt, type ReopeningPage } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const CLOSED = ["CLOSED", "CLOSED_INADMISSIBLE", "CLOSED_INCOMPLETE"];
const REQUIRED = ["ground_kind", "ground_ref"] as const;

/**
 * SCR-CAS-15 Reopen a case. A case officer proposes on a closed case - the ground, what it rests on and when that
 * came to exist, and what the reopening displaces, where naming nothing is a statement and leaving it untouched is
 * not - and an authority other than the proposer authorises it, or refuses it with the reason the proposer then reads.
 * A raiser's own proposal from SCR-CAS-08 waits here the same way. The proposer sees Authorise and Refuse disabled,
 * with the catalogue's sentence beside them, which names nobody; the earlier decision stays readable on the case.
 */
export default async function ReopenCasePage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-CAS", "ACT-DSP");
  const [{ reference: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const attempt = readForPage<ConsoleAttempt>(query);
  const kept = attempt !== null && attempt.subject === reference ? attempt : null;
  const outcome = view === "loading" ? null : await loadReopeningPage(staff, reference, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // A refusal of the reopening decision is said in the page header, its missing reason included: the field was the dialog's.
  const header = kept !== null && (Object.keys(kept.refusal.fields).length === 0 || kept.form === "refuse") ? refusalWords(t, kept.refusal, locale) : null;
  const officer = holds(staff, "ACT-CAS");

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={officer ? [{ label: t("cas03.title"), href: routes.opsCases() }, { label: reference, href: routes.opsCase(reference) }] : [{ label: t("casAp.title"), href: routes.opsCaseApprovals() }, { label: reference }]}
          title={t("cas15.title", { ref: reference })}
          {...(data !== null
            ? {
                status: opsStatus(data.state),
                ...(data.closedOn !== null && data.decision !== null
                  ? { meta: t("cas15.meta", { d: day(data.closedOn, locale), remedy: t(`cas.remedy.${data.decision.remedy}`) }) }
                  : data.closedOn !== null
                    ? { meta: t("cas15.metaClosed", { d: day(data.closedOn, locale) }) }
                    : {}),
              }
            : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" icon="arrow-left" href={officer ? routes.opsCase(reference) : routes.opsCaseApprovals()} locale={locale}>
            {t("cas15.cancel")}
          </Button>
        </PageHeader>
        {header !== null ? (
          <Banner family="danger" title={header.title} code={header.code} live density="console" locale={locale}>
            {header.text}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ConsoleFailure failure={failure} errorTitle={t("cas15.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
        ) : data === null ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={4} density="console" locale={locale} />
          </Panel>
        ) : (
          <>
            {data.open !== null ? (
              <Proposal data={data} staff={staff} t={t} locale={locale} />
            ) : CLOSED.includes(data.state) && officer ? (
              <Propose data={data} kept={kept?.form === "propose" ? kept : null} t={t} locale={locale} />
            ) : (
              <Panel level={2} density="console" locale={locale}>
                <Text size="base">{CLOSED.includes(data.state) ? t("cas15.onlyOfficer") : t("cas15.notClosed", { state: data.state })}</Text>
              </Panel>
            )}
            <Panel title={t("cas15.history")} level={2} density="console" locale={locale}>
              <Table
                columns={[
                  { key: "ref", label: t("casAp.cReopening"), kind: "id" },
                  { key: "ground", label: t("casAp.cGround"), kind: "stack" },
                  { key: "displaced", label: t("cas15.cDisplaced") },
                  { key: "decided", label: t("cas15.cDecided"), kind: "datetime" },
                  { key: "reason", label: t("cas15.cReason"), missing: "–" },
                  { key: "state", label: t("cas03.cState"), kind: "status" },
                ]}
                rows={data.history.map((entry) => ({
                  _key: entry.reference,
                  ref: entry.reference,
                  ground: { text: t(`casops.groundKind.${entry.groundKind}`), detail: entry.groundRef },
                  displaced: entry.displaced.length > 0 ? entry.displaced.map((kind) => t(`cas.remedy.${kind}`)).join(", ") : t("cas15.nothing"),
                  decided: entry.decidedAt,
                  reason: entry.refusedReason,
                  state: { family: "neutral", label: entry.state, quiet: true },
                }))}
                empty={{ variant: "governed", title: t("cas15.emptyTitle"), action: false }}
                density="console"
                caption={t("cas15.history")}
                locale={locale}
              />
            </Panel>
          </>
        )}
      </div>
    </OpsFrame>
  );
}

/** The proposal waiting: its ground and displacement, and Authorise, which the proposer sees disabled with the reason. */
function Proposal({ data, staff, t, locale }: { data: ReopeningPage; staff: Staff; t: Translate; locale: Locale }) {
  const open = data.open;
  if (open === null) return null;
  const proposer = open.proposedBy.email === staff.email;
  const displaced = open.displaced.length > 0 ? open.displaced.map((kind) => t(`cas.remedy.${kind}`)).join(", ") : t("cas15.nothing");
  const why = proposer ? refusalWords(t, "REOPEN_AUTHORITY_CONFLICT", locale).text : !holds(staff, "ACT-DSP") ? t("cas15.whyAuthority") : null;
  const formId = `authorise-${open.reference}`;
  const refuseId = `refuse-${open.reference}`;
  return (
    <>
      <Panel title={t("cas15.proposal", { ref: open.reference })} level={2} density="console" gap="md" status={{ family: "attention", label: open.state, quiet: true }} locale={locale}>
        <FactList
          columns={2}
          items={[
            { label: t("cas15.ground"), value: t(`casops.groundKind.${open.groundKind}`) },
            { label: t("cas15.restsOn"), value: open.groundRef },
            { label: t("cas15.evidenceOn"), value: open.evidenceOn, kind: "date", missing: t("cas15.notEvidence") },
            { label: t("cas15.displaces"), value: displaced },
            { label: t("cas15.proposedAt"), value: open.proposedAt, kind: "datetime" },
            { label: t("cas15.proposedBy"), value: t(`cas15.proposer.${open.proposer}`) },
          ]}
          density="console"
          locale={locale}
        />
      </Panel>
      {proposer ? (
        <Banner family="neutral" title={t("cas15.cannotTitle")} density="console" locale={locale}>
          {t("cas15.cannotText")}
        </Banner>
      ) : null}
      <form id={refuseId} action={refuseReopening.bind(null, data.reference, open.reference)}>
        <input type="hidden" name="reason" value="" />
      </form>
      <form id={formId} action={authoriseReopening.bind(null, data.reference, open.reference)}>
        <ButtonRow align="end">
          <ConfirmSubmit
            formId={refuseId}
            label={t("cas15.refuse")}
            variant="secondary"
            disabledReason={why}
            field={{ name: "reason", label: t("cas15.refuseReason"), missing: t("cas15.refuseMissing") }}
            dialog={{
              title: t("cas15.refuseTitle", { ref: data.reference }),
              description: t("cas15.refuseText"),
              confirm: t("cas15.refuseConfirm"),
              confirmVariant: "danger",
              back: t("cas07.issueBack"),
            }}
            locale={locale}
          />
          <ConfirmSubmit
            formId={formId}
            label={t("cas15.authorise")}
            disabledReason={why}
            dialog={{
              title: t("cas15.authoriseTitle", { ref: data.reference }),
              description: t("cas15.authoriseText", { displaced }),
              confirm: t("cas15.authoriseConfirm"),
              back: t("cas07.issueBack"),
            }}
            locale={locale}
          />
        </ButtonRow>
      </form>
    </>
  );
}

/** Send for authorisation: the ground, what it rests on, and the displacement statement over the decision's outcomes. */
function Propose({ data, kept, t, locale }: { data: ReopeningPage; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const typed = (name: string): string => {
    const value = kept?.values[name];
    return typeof value === "string" ? value : "";
  };
  const chosen = (() => {
    const value = kept?.values.displaced_outcomes;
    return value === undefined ? [] : typeof value === "string" ? [value] : [...value];
  })();
  const refusal = kept?.refusal ?? null;
  const field = (name: string, label: string) => fieldRefusal(t, refusal, name, label, locale);
  const outcomes = data.decision?.outcomes ?? [];
  return (
    <RequiredForm action={proposeReopening.bind(null, data.reference)} required={REQUIRED} initiallyMissing={REQUIRED.filter((name) => typed(name) === "")}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Panel title={t("cas15.groundTitle")} level={2} density="console" gap="md" locale={locale}>
          <ChoiceList
            legend={t("cas15.ground")}
            name="ground_kind"
            options={GROUND_KINDS.map((kind) => ({ value: kind, label: t(`casops.groundKind.${kind}`) }))}
            {...(typed("ground_kind") !== "" ? { value: typed("ground_kind") } : {})}
            layout="inline"
            required
            {...field("groundKind", t("cas15.ground"))}
            density="console"
            locale={locale}
          />
          <TextField label={t("cas15.restsOn")} name="ground_ref" value={typed("ground_ref")} helper={t("cas15.restsOnHelp")} required {...field("groundRef", t("cas15.restsOn"))} density="console" locale={locale} />
          <DateField
            label={t("cas15.evidenceOn")}
            name="evidence_date"
            value={isoDate(typed("evidence_date"))}
            max={data.today}
            today={data.today}
            helper={t("cas15.evidenceOnHelp")}
            {...field("evidenceOn", t("cas15.evidenceOn"))}
            density="console"
            locale={locale}
          />
          {data.windowEnds !== null ? (
            <Text size="sm" tone="secondary">
              {t("cas15.window", { d: day(data.windowEnds, locale) })}
            </Text>
          ) : null}
        </Panel>
        <Panel title={t("cas15.displaceTitle")} level={2} density="console" gap="sm" locale={locale}>
          {/* Only what the decision carried can be named, and naming nothing is its own answer. */}
          <ChoiceList
            legend={t("cas15.displaces")}
            name="displaced_outcomes"
            multiple
            options={outcomes.map((kind) => ({ value: kind, label: t(`cas.remedy.${kind}`) }))}
            value={chosen.filter((value) => value !== "nothing")}
            {...field("displaced", t("cas15.displaces"))}
            density="console"
            locale={locale}
          />
          <Checkbox label={t("cas15.nothingOption")} name="displaced_outcomes" value="nothing" checked={chosen.includes("nothing")} density="console" locale={locale} />
          <Text size="sm" tone="secondary">
            {t("cas15.nothingNote")}
          </Text>
        </Panel>
        <ButtonRow align="end">
          <RequiredSubmit
            variant="primary"
            size="sm"
            reasons={[
              { field: "ground_kind", text: t("cas15.needGround") },
              { field: "ground_ref", text: t("cas15.needRestsOn") },
            ]}
            locale={locale}
          >
            {t("cas15.send")}
          </RequiredSubmit>
        </ButtonRow>
      </div>
    </RequiredForm>
  );
}

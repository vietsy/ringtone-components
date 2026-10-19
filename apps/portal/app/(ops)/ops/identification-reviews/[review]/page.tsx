import { Banner, Button, ButtonRow, Comparison, FactList, FileList, PageHeader, Panel, Skeleton, StatusLine, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { decideReviewAction } from "@/features/parties/actions";
import { codeStatus, count, day, evidenceWords, joinNames, originWords, partyTranslator, refusal, sourceLine } from "@/features/parties/copy";
import { DuplicateDecision } from "@/features/parties/DuplicateDecision";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { SubmitButton } from "@/features/parties/SubmitButton";
import { readForPage } from "@/lib/api/flash";
import { loadReviewDetail, type CandidateRecord, type PartyAttempt, type ReviewDetail } from "@/lib/api/parties";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-05 Review detail and decision. A duplicate candidacy shows the two records side by side, field by field,
 * then the decision: the surviving record and, for each kind of reference pointing at the record to be superseded,
 * where it goes (FR-PTY-032). An identification review shows the declaration and offers The declaration stands or
 * Return for another identification (SM-193 transitions 3 and 4). A decision is recorded under the officer's name;
 * a review another officer closed first answers REVIEW_NOT_OPEN, naming them.
 */
export default async function ReviewPage({ params, searchParams }: { params: Promise<{ review: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-AUD");
  const { review } = await params;
  const query = await searchParams;
  const locale = await getLocale();
  const t = partyTranslator(locale);
  const asked = reviewView(query, PARTIES_VIEWS);
  const outcome = asked === "loading" ? null : await loadReviewDetail(staff, review, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = readForPage<PartyAttempt>(query);
  const mine = attempt !== null && attempt.form === "decide" && attempt.subject === review ? attempt : null;

  return (
    <OpsFrame console="operations" current="parties" staff={staff} searchLabel={t("party.search")} keyMap={[{ keys: ["Esc"], label: t("pty03.kEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("party.crumb"), href: routes.opsParties() },
            { label: t("pty04.title"), href: routes.opsIdentificationReviews() },
          ]}
          title={data !== null ? title(data, t) : t("pty05.titleGeneric")}
          {...(data !== null ? { status: codeStatus(data.state, t), meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        {failure !== null ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            <PartyFailure failure={failure} screen="pty05" errorTitle={t("pty05.errTitle")} density="console" t={t} locale={locale} />
            {failure.code === "REVIEW_NOT_FOUND" ? (
              <Button variant="secondary" size="sm" href={routes.opsIdentificationReviews()} locale={locale}>
                {t("pty05.backReviews")}
              </Button>
            ) : null}
          </div>
        ) : data === null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Panel title={t("pty05.records")} compact locale={locale}>
              <Skeleton variant="table" rows={7} columns={3} density="console" locale={locale} />
            </Panel>
            <Panel title={t("pty05.decision")} compact locale={locale}>
              <Skeleton variant="card" rows={6} density="console" locale={locale} />
            </Panel>
          </div>
        ) : (
          <Body data={data} attempt={mine} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function title(data: ReviewDetail, t: Translate): string {
  if (data.candidates !== null) return t("pty05.titleDup", { name: data.candidates[0].legalName });
  return t("pty05.titleIdent", { name: data.identification?.legalName ?? "" });
}

function meta(data: ReviewDetail, t: Translate, locale: Locale): string {
  const opened = day(data.openedAt, locale);
  if (data.candidates !== null) {
    const [a, b] = data.candidates;
    const same = a.businessRegistration !== null && a.businessRegistration === b.businessRegistration;
    if (data.state !== "OPEN") return same ? t("pty05.metaClosed", { d: opened, reg: a.businessRegistration ?? "" }) : t("pty05.metaClosedPlain", { d: opened });
    return same ? t("pty05.metaDup", { d: opened, n: count(data.age, locale), reg: a.businessRegistration ?? "" }) : t("pty05.metaDupPlain", { d: opened, n: count(data.age, locale) });
  }
  return data.state === "OPEN" ? t("pty05.metaIdent", { d: opened, n: count(data.age, locale) }) : t("pty05.metaIdentClosed", { d: opened });
}

function Body({ data, attempt, t, locale }: { data: ReviewDetail; attempt: PartyAttempt | null; t: Translate; locale: Locale }) {
  const decided = attempt !== null && attempt.refusal === null && data.decision !== null;
  const notOpen = attempt?.refusal?.code === "REVIEW_NOT_OPEN" ? attempt.refusal : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      {decided && data.decision !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t(`pty05.toast.${data.decision.outcome}`)} action={{ label: t("pty05.backParties"), href: routes.opsParties() }} locale={locale}>
            {toastText(data, t)}
          </Toast>
        </div>
      ) : null}
      {notOpen !== null ? (
        <Banner
          family="attention"
          title={refusal(t, "REVIEW_NOT_OPEN", "pty05", notOpen.values).title}
          code="REVIEW_NOT_OPEN"
          action={{ label: t("pty05.backReviews"), href: routes.opsIdentificationReviews(), variant: "secondary" }}
          density="console"
          locale={locale}
        >
          {refusal(t, "REVIEW_NOT_OPEN").text}
        </Banner>
      ) : null}
      {data.candidates !== null ? (
        <Panel title={t("pty05.records")} compact locale={locale}>
          <Comparison
            caption={t("pty05.records")}
            rowLabel={t("pty05.rowLabel")}
            columns={[
              { key: "a", label: t("pty05.recA"), meta: data.candidates[0].record },
              { key: "b", label: t("pty05.recB"), meta: data.candidates[1].record },
            ]}
            rows={comparisonRows(data.candidates, t, locale)}
            density="console"
            locale={locale}
          />
        </Panel>
      ) : null}
      {data.identification !== null ? <Declaration data={data} t={t} locale={locale} /> : null}
      {data.decision !== null ? (
        <Decided data={data} t={t} locale={locale} />
      ) : data.mayAct && data.candidates !== null ? (
        <DuplicateDecision candidates={data.candidates} action={decideReviewAction.bind(null, data.id)} attempt={attempt} locale={locale} />
      ) : data.mayAct && data.identification !== null ? (
        <IdentificationDecision data={data} attempt={attempt} t={t} locale={locale} />
      ) : null}
    </div>
  );
}

function toastText(data: ReviewDetail, t: Translate): string {
  const decision = data.decision;
  if (decision === null) return "";
  switch (decision.outcome) {
    case "LINKED":
      return t("pty05.toastText.LINKED", { superseded: decision.superseded ?? "", survivor: decision.survivor ?? "" });
    case "NOT_LINKED":
      return t("pty05.toastText.NOT_LINKED");
    case "STANDS":
    case "RETURNED":
      return t(`pty05.toastText.${decision.outcome}`, { name: data.identification?.legalName ?? "" });
  }
}

/** The two records field by field; a field that differs is marked, so the officer reads the difference first. */
function comparisonRows(candidates: readonly [CandidateRecord, CandidateRecord], t: Translate, locale: Locale) {
  const premises = (record: CandidateRecord) =>
    record.premises.ended !== null && record.premises.current === 0
      ? t("pty05.premEnded", { n: count(record.premises.ended.names.length, locale), d: day(record.premises.ended.on, locale), names: joinNames(record.premises.ended.names, t) })
      : t("pty02.premCount", { n: count(record.premises.current, locale) });
  const [a, b] = candidates;
  const row = (key: string, label: string, va: string | null, vb: string | null) => ({ key, label, values: { a: va, b: vb }, ...(va !== vb ? { changed: true } : {}) });
  return [
    row("name", t("pty05.rName"), a.legalName, b.legalName),
    row("reg", t("pty05.rReg"), a.businessRegistration, b.businessRegistration),
    row("kind", t("pty05.rKind"), t(`party.kind.${a.kind}`), t(`party.kind.${b.kind}`)),
    row("origin", t("pty05.rOrigin"), originWords(a.origin, t, locale), originWords(b.origin, t, locale)),
    row("state", t("pty05.rState"), a.state, b.state),
    { ...row("principal", t("pty05.rPrincipal"), a.principal, b.principal), missing: t("party.notRecorded") },
    row("premises", t("pty05.rPremises"), premises(a), premises(b)),
    { key: "aut", label: t("pty05.rAut"), values: { a: a.authorities, b: b.authorities }, kind: "count" as const, ...(a.authorities !== b.authorities ? { changed: true } : {}) },
  ];
}

/** The declaration under review, as it was made: route, source, evidence, scan, reason and who declared it when. */
function Declaration({ data, t, locale }: { data: ReviewDetail; t: Translate; locale: Locale }) {
  const subject = data.identification;
  if (subject === null) return null;
  const declaration = subject.view.declaration;
  return (
    <Panel title={t("pty05.declaration")} compact locale={locale}>
      <FactList
        items={[
          { label: t("pty05.fParty"), value: subject.record, kind: "id" },
          { label: t("pty05.fReg"), value: subject.businessRegistration, kind: "mono", missing: t("party.noReg") },
          { label: t("pty03.fRoute"), value: t("pty03.manual") },
          { label: t("pty03.fSource"), value: sourceLine(subject.view, t, locale) },
          ...(declaration !== null
            ? [
                { label: t("pty05.fEvKind"), value: evidenceWords(declaration.evidenceKind, t) },
                { label: t("pty03.evRef"), value: declaration.evidenceRef, kind: "mono" as const },
                { label: t("pty03.operator"), value: declaration.by },
              ]
            : []),
          ...(subject.view.at !== null ? [{ label: t("pty03.fDeclaredAt"), value: subject.view.at, kind: "datetime" as const }] : []),
          ...(declaration !== null ? [{ label: t("pty03.fReason"), value: declaration.reason }] : []),
        ]}
        columns={2}
        density="console"
        locale={locale}
      />
      {declaration?.scan !== null && declaration?.scan !== undefined ? (
        <FileList items={[{ key: "scan", name: declaration.scan.name, type: declaration.scan.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image", state: "ready", at: declaration.scan.at, by: declaration.scan.by }]} label={t("pty03.scan")} density="console" locale={locale} />
      ) : null}
    </Panel>
  );
}

/** An identification review's two outcomes, each sent as it is: the declaration stands, or it is returned. */
function IdentificationDecision({ data, attempt, t, locale }: { data: ReviewDetail; attempt: PartyAttempt | null; t: Translate; locale: Locale }) {
  const action = decideReviewAction.bind(null, data.id);
  return (
    <Panel title={t("pty05.decision")} compact locale={locale}>
      <StatusLine family="info" text={t("pty05.identOutcome")} cutout="surface" locale={locale} />
      {attempt?.refusal?.code === "DECISION_REQUIRED" ? (
        <Banner family="attention" title={refusal(t, "DECISION_REQUIRED", "pty05").title} code="DECISION_REQUIRED" density="console" locale={locale}>
          {refusal(t, "DECISION_REQUIRED").text}
        </Banner>
      ) : null}
      <ButtonRow>
        <form action={action}>
          <input type="hidden" name="intent" value="STANDS" />
          <SubmitButton variant="primary" size="sm" locale={locale}>
            {t("pty05.stands")}
          </SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="intent" value="RETURNED" />
          <SubmitButton variant="secondary" size="sm" locale={locale}>
            {t("pty05.returnIt")}
          </SubmitButton>
        </form>
      </ButtonRow>
    </Panel>
  );
}

/** The decision recorded: who decided, when, and on a linkage where every kind of reference went. */
function Decided({ data, t, locale }: { data: ReviewDetail; t: Translate; locale: Locale }) {
  const decision = data.decision;
  if (decision === null) return null;
  const survivor = data.candidates?.find((record) => record.record === decision.survivor) ?? null;
  const superseded = data.candidates?.find((record) => record.record === decision.superseded) ?? null;
  const facts =
    decision.outcome === "LINKED"
      ? [
          { label: t("pty05.fSurvivor"), value: survivor?.legalName ?? decision.survivor, note: decision.survivor ?? "" },
          { label: t("pty05.fSuperseded"), value: superseded?.legalName ?? decision.superseded, note: decision.superseded ?? "" },
          ...decision.dispositions.map((entry) => ({
            label: t("party.class.label", { name: t(`party.class.${entry.key}.name`), n: count(entry.count, locale) }),
            value: entry.to === "MOVE" ? t("pty05.move", { s: decision.survivor ?? "" }) : t("pty05.stay", { o: decision.superseded ?? "" }),
          })),
        ]
      : decision.outcome === "NOT_LINKED" && data.candidates !== null
        ? [{ label: t("pty05.fRecords"), value: t("pty05.distinct", { a: data.candidates[0].record, b: data.candidates[1].record }) }]
        : [{ label: t("pty05.fOutcome"), value: t(`pty05.outcome.${decision.outcome}`) }];
  return (
    <Panel title={t("pty05.decisionRecorded")} status={codeStatus(decision.outcome, t)} compact locale={locale}>
      <FactList
        items={[...facts, { label: t("pty05.fBy"), value: decision.by }, { label: t("pty05.fAt"), value: decision.at, kind: "datetime" }]}
        columns={2}
        density="console"
        locale={locale}
      />
      {decision.outcome === "LINKED" ? <StatusLine family="info" text={t("pty05.neither")} cutout="surface" locale={locale} /> : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--space-2)" }}>
        <Button variant="secondary" size="sm" href={routes.opsParties()} locale={locale}>
          {t("pty05.backParties")}
        </Button>
        {data.identification !== null ? (
          <Button variant="quiet" size="sm" href={routes.opsParty(data.identification.record)} locale={locale}>
            {t("pty05.openParty")}
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

import { redirect } from "next/navigation";
import {
  Banner,
  Button,
  Columns,
  EmptyState,
  FactList,
  PageHeader,
  Panel,
  Skeleton,
  Table,
  TextField,
  Toast,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { addPersonAction, amendPersonAction, recordPrincipalAction } from "@/features/parties/actions";
import { actsWords, codeStatus, day, evidenceWords, moment, partyTranslator, provenanceOf, refusal, scopeWords, shortDay, sourceLine, span } from "@/features/parties/copy";
import { PanelForm } from "@/features/parties/PanelForm";
import { ShortcutButton } from "@/features/parties/ShortcutButton";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { PrincipalFields } from "@/features/parties/PrincipalFields";
import { readForPage } from "@/lib/api/flash";
import { loadPartyAuthorities, loadPartyDetail, loadPartyPerson, type AuthorityRow, type PartyAttempt, type PartyDetail, type PartyPersonView, type PremisesRow } from "@/lib/api/parties";
import { currentPrincipal, requireStaff, type Principal, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

const LICENSING_FAMILY = { LICENSED: "positive", UNREGISTERED: "neutral", LAPSED: "attention" } as const;

/**
 * SCR-PTY-02 Party detail. How the party was identified comes first under the heading, because whether a fact came
 * from the source or a declaration decides how much weight the rest deserves; then an open review on the record, the
 * party, its premises and who may act for it. Granting an authority is the principal's act on the premises portal,
 * so the console lists the authorities and grants none; the officer adds a person to the register and records a
 * principal beside the page. A principal who opens a party their authority does not cover meets NOT_YOUR_PARTY on the
 * premises portal; their own party's authorities are where its page leads them.
 */
export default async function PartyPage({ params, searchParams }: { params: Promise<{ party: string }>; searchParams: Promise<SearchParams> }) {
  const { party: record } = await params;
  const query = await searchParams;
  const principal = await currentPrincipal();
  if (principal !== null) return <NotYourParty principal={principal} record={record} query={query} />;
  const staff = await requireStaff("ACT-OPS", "ACT-AUD");
  const locale = await getLocale();
  const t = partyTranslator(locale);
  const asked = reviewView(query, PARTIES_VIEWS);
  const outcome = asked === "loading" ? null : await loadPartyDetail(staff, record, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = readForPage<PartyAttempt>(query);
  // A refused panel act opens its panel again with the values kept; otherwise the address says which panel is open.
  const kept = attempt !== null && attempt.refusal !== null && (attempt.form === "person" || attempt.form === "principal") ? attempt.form : attempt?.form === "amendPerson" && attempt.refusal !== null ? "amend-person" : null;
  const askedPanel = query.panel === "person" || query.panel === "principal" || query.panel === "amend-person" ? query.panel : null;
  // The person the amend panel is open on: the one asked for, or the one a refused amendment named.
  const chosen = typeof query.person === "string" && query.person !== "" ? query.person : attempt?.form === "amendPerson" ? attempt.subject : null;
  const panel = data !== null && data.mayAct && data.state !== "SUPERSEDED" ? (kept ?? askedPanel) : null;

  return (
    <OpsFrame
      console="operations"
      current="parties"
      staff={staff}
      searchLabel={t("party.search")}
      keyMap={[
        // The premises table binds the row keys, so they are listed only while it has rows; Enter opens the premises.
        ...(data !== null && data.premises.length > 0 ? [{ keys: ["J", "K"], label: t("pty02.kMove") }, { keys: ["Enter"], label: t("pty02.kOpen") }] : []),
        ...(panel !== null ? [{ keys: ["Esc"], label: t("pty02.kEsc") }] : []),
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("party.crumb") }, { label: t("pty01.title"), href: routes.opsParties() }]}
          title={data?.legalName ?? t("pty02.genericTitle")}
          {...(data !== null ? { status: codeStatus(data.state, t), meta: metaLine(data, t, locale) } : {})}
          locale={locale}
        >
          {data !== null && data.mayAct ? <HeaderActions data={data} t={t} locale={locale} /> : null}
        </PageHeader>
        {failure !== null ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            <PartyFailure failure={failure} screen="pty02" errorTitle={t("pty02.errTitle")} density="console" t={t} locale={locale} />
            {failure.code === "PARTY_NOT_FOUND" ? (
              <Button variant="secondary" size="sm" href={routes.opsParties()} locale={locale}>
                {t("pty02.backParties")}
              </Button>
            ) : null}
          </div>
        ) : data === null ? (
          <Loading t={t} locale={locale} />
        ) : (
          <Columns side="md" single={!(panel !== null)}>
            <Content data={data} attempt={attempt} narrow={panel !== null} t={t} locale={locale} />
            {panel === "person" ? <PersonPanel data={data} attempt={attempt?.form === "person" ? attempt : null} t={t} locale={locale} /> : null}
            {panel === "amend-person" ? <AmendPersonPanel data={data} staff={staff} person={chosen} attempt={attempt?.form === "amendPerson" ? attempt : null} t={t} locale={locale} /> : null}
            {panel === "principal" ? (
              <PanelForm
                action={recordPrincipalAction.bind(null, data.record)}
                title={t("pty02.recordPrincipal")}
                eyebrow={t("pty02.principalEyebrow")}
                submit={t("pty02.recordPrincipal")}
                cancel={t("party.cancel")}
                closeHref={routes.opsParty(data.record)}
                locale={locale}
              >
                <PrincipalFields party={data} attempt={attempt?.form === "principal" ? attempt : null} locale={locale} />
              </PanelForm>
            ) : null}
          </Columns>
        )}
      </div>
    </OpsFrame>
  );
}

/** The identification line under the heading: from the source and when, by a declaration, or not yet. */
function metaLine(data: PartyDetail, t: Translate, locale: Locale): string {
  if (data.state === "SUPERSEDED" && data.supersededBy !== null) {
    return t("party.superseded", { name: data.supersededBy.legalName, rec: data.supersededBy.record, d: day(data.supersededBy.on, locale), by: data.supersededBy.by });
  }
  if (data.state === "DRAFT") return t("pty02.draftLine");
  if (data.state === "REFERRED") return t("pty02.referredLine");
  const identification = data.identification;
  if (identification?.route === "MANUAL" && identification.at !== null) return t("pty02.manualLine", { ts: moment(identification.at, locale) });
  return identification?.at !== null && identification?.at !== undefined ? t("pty02.idLine", { ts: moment(identification.at, locale) }) : t("pty02.idLineUndated");
}

function HeaderActions({ data, t, locale }: { data: PartyDetail; t: Translate; locale: Locale }) {
  const identified = data.state === "IDENTIFIED";
  return (
    <>
      {data.state === "DRAFT" ? (
        <Button variant="primary" size="sm" href={routes.opsPartyIdentification(data.record)} locale={locale}>
          {t("pty02.identify")}
        </Button>
      ) : null}
      {data.state !== "SUPERSEDED" ? (
        <>
          <ShortcutButton variant="secondary" size="sm" icon="user" shortcut="Alt+P" href={routes.opsParty(data.record, "person")} locale={locale}>
            {t("pty02.addPerson")}
          </ShortcutButton>
          <Button variant="secondary" size="sm" icon="users" href={routes.opsPartyPerson(data.record, "")} locale={locale}>
            {t("pty02.amendPerson")}
          </Button>
          <ShortcutButton
            variant="secondary"
            size="sm"
            icon="key-round"
            shortcut="Alt+R"
            {...(identified ? { href: routes.opsParty(data.record, "principal") } : { disabled: true, disabledReason: t("party.refusal.PARTY_NOT_IDENTIFIED.text") })}
            locale={locale}
          >
            {t("pty02.recordPrincipal")}
          </ShortcutButton>
        </>
      ) : null}
    </>
  );
}

/** What the last act on this page recorded, said once at the top. */
function DoneToast({ data, attempt, t, locale }: { data: PartyDetail; attempt: PartyAttempt | null; t: Translate; locale: Locale }) {
  if (attempt === null || attempt.refusal !== null || attempt.done === null) return null;
  let words: { title: string; text: string } | null = null;
  if (attempt.form === "create" && attempt.done === data.record) words = { title: t("pty02.toastCreated"), text: t("pty02.toastCreatedText", { name: data.legalName }) };
  if (attempt.form === "declare" && data.state === "IDENTIFIED") words = { title: t("pty02.toastIdentified"), text: t("pty02.toastIdentifiedText", { name: data.legalName }) };
  if (attempt.form === "person") {
    const person = data.persons.find((entry) => entry.reference === attempt.done);
    if (person !== undefined) words = { title: t("pty02.toastPerson"), text: t("pty02.toastPersonText", { name: person.name, ref: person.reference, party: data.legalName }) };
  }
  if (attempt.form === "amendPerson") {
    const person = data.persons.find((entry) => entry.reference === attempt.done);
    if (person !== undefined) words = { title: t("pty02.apDone", { name: person.name }), text: t("pty02.apDoneText", { ref: person.reference }) };
  }
  if (attempt.form === "principal") {
    const authority = data.authorities.find((entry) => entry.reference === attempt.done);
    if (authority !== undefined) words = { title: t("pty02.toastTitle"), text: t("pty02.toastText", { name: authority.person, party: data.legalName, d: day(authority.from, locale) }) };
  }
  if (words === null) return null;
  return (
    <div style={{ maxWidth: "var(--container-lg)" }}>
      <Toast family="positive" title={words.title} locale={locale}>
        {words.text}
      </Toast>
    </div>
  );
}

function Content({ data, attempt, narrow, t, locale }: { data: PartyDetail; attempt: PartyAttempt | null; narrow: boolean; t: Translate; locale: Locale }) {
  const provenance = provenanceOf(data.origin);
  const draft = data.state === "DRAFT";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      <DoneToast data={data} attempt={attempt} t={t} locale={locale} />
      {data.duplicate !== null ? (
        <Banner
          family="attention"
          title={t("pty02.dupTitle")}
          action={{ label: t("pty02.openReview"), href: routes.opsIdentificationReview(data.duplicate.review), variant: "secondary" }}
          density="console"
          locale={locale}
        >
          {data.duplicate.other.origin.kind === "IMPORTED"
            ? t("pty02.dupTextImported", { name: data.duplicate.other.legalName, rec: data.duplicate.other.record, d: day(data.duplicate.other.origin.on, locale) })
            : t("pty02.dupText", { name: data.duplicate.other.legalName, rec: data.duplicate.other.record })}
        </Banner>
      ) : null}
      {data.identificationReview !== null ? (
        <Banner
          family="attention"
          title={t("pty02.idReviewTitle")}
          action={{ label: t("pty02.openReview"), href: routes.opsIdentificationReview(data.identificationReview), variant: "secondary" }}
          density="console"
          locale={locale}
        >
          {t("pty02.idReviewText")}
        </Banner>
      ) : null}
      <Columns layout="halves" single={narrow}>
        <Panel title={t("pty02.party")} compact locale={locale}>
          <FactList
            items={[
              { label: t("pty02.fName"), value: data.legalName, provenance },
              { label: t("pty02.fRec"), value: data.record, kind: "id" },
              { label: t("pty02.fReg"), value: data.businessRegistration, kind: "mono", ...(data.businessRegistration !== null ? { provenance } : {}), missing: t("party.noReg") },
              { label: t("pty02.fKind"), value: t(`party.kind.${data.kind}`) },
              data.principal !== null
                ? { label: t("pty02.fPrincipal"), value: data.principal.name, ...(data.principal.fromRegister ? { provenance: "registry-sourced" as const, note: t("pty02.principalNote") } : {}) }
                : { label: t("pty02.fPrincipal"), value: null, missing: t("party.notRecorded") },
            ]}
            density="console"
            locale={locale}
          />
        </Panel>
        <Panel title={t("pty02.identification")} compact locale={locale}>
          {data.identification !== null ? (
            <FactList items={identificationFacts(data, t, locale)} density="console" locale={locale} />
          ) : (
            <EmptyState variant="not-started" title={t("pty02.noIdTitle")} action={false} density="console" locale={locale}>
              {data.state === "REFERRED" ? t("pty02.noIdReferred") : t("pty02.noIdText")}
            </EmptyState>
          )}
        </Panel>
      </Columns>
      <Panel title={t("pty02.premises")} {...(data.premises.length > 0 ? { meta: t("pty02.premCount", { n: String(data.premises.length) }) } : {})} compact locale={locale}>
        {data.premises.length > 0 ? (
          <Table
            columns={[
              { key: "name", label: t("pty02.cPrem"), kind: "strong", minWidth: "var(--space-56)" },
              { key: "rec", label: t("pty02.cRec"), kind: "id", missing: t("party.notRecorded") },
              { key: "since", label: t("pty02.cSince"), kind: "date", short: true, missing: t("party.notRecorded") },
              { key: "lic", label: t("pty02.cLicensing"), kind: "status", help: t("pty02.licensingHelp") },
              { key: "record", label: t("pty02.cRecord"), kind: "entries", nowrap: true },
              { key: "issued", label: t("pty02.cIssued"), kind: "date", short: true, missing: t("pty02.noRecord") },
            ]}
            rows={data.premises.map((row, index) => premisesRow(row, index, t))}
            density="console"
            rowFocus
            caption={t("pty02.premises")}
            locale={locale}
          />
        ) : (
          <EmptyState variant="not-started" title={t("pty02.noPremTitle")} action={false} density="console" locale={locale}>
            {t("pty02.noPremText")}
          </EmptyState>
        )}
      </Panel>
      <Panel title={t("pty02.authorities")} {...(!draft ? { description: t("pty02.autDesc") } : {})} compact locale={locale}>
        {data.authorities.length > 0 ? (
          <Table
            columns={[
              { key: "id", label: t("pty02.cAut"), kind: "id" },
              { key: "who", label: t("pty02.cPerson"), nowrap: true },
              { key: "scope", label: t("pty02.cScope"), kind: "stack", minWidth: "var(--space-56)" },
              { key: "period", label: t("pty02.cPeriod"), kind: "stack", detailSize: "sm", minWidth: "var(--space-48)" },
              { key: "st", label: t("pty02.cState"), kind: "status" },
            ]}
            rows={data.authorities.map((row) => authorityRow(row, t, locale))}
            density="console"
            caption={t("pty02.authorities")}
            locale={locale}
          />
        ) : (
          <EmptyState variant="not-started" title={t("pty02.noAutTitle")} action={false} density="console" locale={locale}>
            {t("pty02.noAutText")}
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}

function identificationFacts(data: PartyDetail, t: Translate, locale: Locale) {
  const identification = data.identification;
  if (identification === null) return [];
  if (identification.route === "SOURCED") {
    return [
      { label: t("pty02.fRoute"), value: t("pty02.fromSource") },
      { label: t("pty02.fSource"), value: t("party.sourceName") },
      ...(identification.identifierKind !== null ? [{ label: t("pty02.fIdentifier"), value: t(`party.identifier.${identification.identifierKind}`) }] : []),
      ...(identification.at !== null ? [{ label: t("pty02.fRetrieved"), value: identification.at, kind: "datetime" as const }] : []),
    ];
  }
  const declaration = identification.declaration;
  return [
    { label: t("pty02.fRoute"), value: t("pty03.manual") },
    { label: t("pty02.fSource"), value: sourceLine(identification, t, locale) },
    ...(declaration !== null
      ? [
          { label: t("pty03.fEvidence"), value: evidenceWords(declaration.evidenceKind, t) },
          { label: t("pty03.evRef"), value: declaration.evidenceRef, kind: "mono" as const },
          { label: t("pty03.fReason"), value: declaration.reason },
          { label: t("pty03.operator"), value: declaration.by },
        ]
      : []),
    ...(identification.at !== null ? [{ label: t("pty03.fDeclaredAt"), value: identification.at, kind: "datetime" as const }] : []),
    ...(identification.decided !== null ? [{ label: t("pty02.fDecided"), value: t("pty02.decidedStands"), note: t("pty02.decidedBy", { name: identification.decided.by, ts: moment(identification.decided.at, locale) }) }] : []),
  ];
}

/** One premises: the status record its licensing status is derived from, or how far its application has gone. */
function premisesRow(row: PremisesRow, index: number, t: Translate): Record<string, unknown> {
  return {
    _key: `${row.record ?? row.name}-${String(index)}`,
    // SCR-PTY-02 to SCR-PTY-07: a premises with a register record opens its page.
    ...(row.record !== null ? { _href: routes.opsPremises(row.record) } : {}),
    name: row.name,
    rec: row.record,
    since: row.since,
    lic: { family: LICENSING_FAMILY[row.licensing], label: t(`party.licensing.${row.licensing}`) },
    record: row.statusRecord !== null ? [{ code: row.statusRecord.reference }] : [{ text: row.application !== null ? t(`pty02.application.${row.application}`) : t("pty02.noRecord") }],
    issued: row.statusRecord?.since ?? null,
  };
}

/** One authority as the console reads it: the code, and a line where the state grants nothing or was ended by a person. */
function authorityRow(row: AuthorityRow, t: Translate, locale: Locale): Record<string, unknown> {
  const note =
    row.recorded !== null && row.state === "EFFECTIVE"
      ? t("pty02.nRecorded", { name: row.recorded.by, ts: moment(row.recorded.at, locale) })
      : row.state === "PENDING_START"
        ? t("pty02.nPending")
        : row.state === "EXPIRED"
          ? t("pty02.nExpired")
          : row.state === "LAPSED"
            ? t("pty02.nLapsed")
            : row.state === "REVOKED" && row.revoked !== null
              ? t("pty02.nRevoked", { name: row.revoked.by, ts: moment(row.revoked.at, locale) })
              : null;
  return {
    _key: row.reference,
    id: row.reference,
    who: row.person,
    scope: { text: scopeWords(row.premises, t), detail: t("pty02.acts", { acts: actsWords(row.acts, t).toLocaleLowerCase() }) },
    period: { text: row.to !== null ? span(row.from, row.to, locale) : t("party.fromOnly", { d: shortDay(row.from, locale) }), ...(note !== null ? { detail: note } : {}) },
    st: codeStatus(row.state, t),
  };
}

/** Add person: a person of the register, with an account only where they have one (FR-PTY-019). */
function PersonPanel({ data, attempt, t, locale }: { data: PartyDetail; attempt: PartyAttempt | null; t: Translate; locale: Locale }) {
  const value = (name: string) => {
    const typed = attempt?.values[name];
    return typeof typed === "string" ? typed : "";
  };
  const failed = attempt?.refusal ?? null;
  return (
    <PanelForm
      action={addPersonAction.bind(null, data.record)}
      title={t("pty02.addPerson")}
      eyebrow={t("pty02.personEyebrow")}
      submit={t("pty02.addPerson")}
      cancel={t("party.cancel")}
      closeHref={routes.opsParty(data.record)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Text size="sm" tone="secondary">
          {t("pty02.personDesc")}
        </Text>
        {failed?.code === "ACCOUNT_ALREADY_LINKED" ? (
          <Banner family="attention" title={refusal(t, failed.code, "pty02", failed.values).title} code={failed.code} level={3} density="console" live locale={locale}>
            {refusal(t, failed.code).text}
          </Banner>
        ) : null}
        <TextField
          label={t("pty02.fDisplay")}
          helper={t("pty02.fDisplayHelp")}
          name="display_name"
          value={value("display_name")}
          {...(failed?.field === "display_name" ? { error: refusal(t, failed.code).text } : {})}
          required
          wrap
          density="console"
          width="100%"
          locale={locale}
        />
        <TextField label={t("pty02.fAccount")} helper={t("pty02.fAccountHelp")} name="account_ref" value={value("account_ref")} mono density="console" width="var(--container-3xs)" locale={locale} />
        <FactList items={[{ label: t("pty02.fBy"), value: data.officer, note: t("pty02.byNote") }]} density="console" locale={locale} />
      </div>
    </PanelForm>
  );
}

/**
 * A person of the register, read and amended (GET and PATCH /party-persons/{id}): the persons on the party's record to
 * open, then the one opened with the account linked, whether the reference still resolves and every authority held,
 * and the form that renames the person or links an account later. The reference the register issued never changes.
 */
async function AmendPersonPanel({ data, staff, person, attempt, t, locale }: { data: PartyDetail; staff: Staff; person: string | null; attempt: PartyAttempt | null; t: Translate; locale: Locale }) {
  const read = person !== null ? await loadPartyPerson(staff, person) : null;
  const view = read?.data ?? null;
  const value = (name: string) => {
    const typed = attempt?.values[name];
    return typeof typed === "string" ? typed : "";
  };
  const failed = attempt?.refusal ?? null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      <Panel title={t("pty02.apTitle")} level={2} compact locale={locale}>
        <Table
          columns={[
            { key: "name", label: t("pty02.apPerson"), kind: "strong" },
            { key: "ref", label: t("pty02.apRef"), kind: "id" },
          ]}
          rows={data.persons.map((entry) => ({ _key: entry.reference, _href: routes.opsPartyPerson(data.record, entry.reference), name: entry.name, ref: entry.reference }))}
          density="console"
          caption={t("pty02.apTitle")}
          locale={locale}
        />
      </Panel>
      {read !== null && read.failure !== null ? (
        <ViewState view="refused" refusal={{ ...refusal(t, read.failure.code), family: "attention" }} density="console" locale={locale} />
      ) : view !== null ? (
        <PanelForm
          action={amendPersonAction.bind(null, data.record, view.reference)}
          title={view.name}
          eyebrow={view.reference}
          submit={t("pty02.apSave")}
          cancel={t("party.cancel")}
          closeHref={routes.opsParty(data.record)}
          locale={locale}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <PersonFacts view={view} t={t} locale={locale} />
            {failed !== null && failed.field === null ? (
              <Banner family="attention" title={refusal(t, failed.code).title} code={failed.code} level={3} density="console" live locale={locale}>
                {refusal(t, failed.code).text}
              </Banner>
            ) : null}
            <TextField
              label={t("pty02.apName")}
              helper={t("pty02.apNameHelp")}
              name="display_name"
              value={value("display_name")}
              {...(failed?.field === "display_name" ? { error: refusal(t, failed.code).text } : {})}
              wrap
              density="console"
              width="100%"
              locale={locale}
            />
            <TextField
              label={t("pty02.apAccount")}
              helper={t("pty02.apAccountHelp")}
              name="account_ref"
              value={value("account_ref")}
              {...(failed?.field === "account_ref" ? { error: refusal(t, failed.code).text } : {})}
              mono
              density="console"
              width="100%"
              locale={locale}
            />
          </div>
        </PanelForm>
      ) : (
        <Text size="sm" tone="secondary">
          {t("pty02.apChoose")}
        </Text>
      )}
    </div>
  );
}

function PersonFacts({ view, t, locale }: { view: PartyPersonView; t: Translate; locale: Locale }) {
  const resolution =
    view.resolution.kind === "SUPERSEDED"
      ? t("pty02.apResolution.SUPERSEDED", { survivor: view.resolution.survivor, ts: moment(view.resolution.effectiveAt, locale) })
      : t(`pty02.apResolution.${view.resolution.kind}`);
  return (
    <FactList
      items={[
        { label: t("pty02.apRef"), value: view.reference, kind: "id" as const, note: t("pty02.apRefHelp") },
        { label: t("pty02.apLinked"), value: view.account, missing: t("pty02.apAccountNone") },
        { label: t("pty02.apRecord"), value: resolution },
        {
          label: t("pty02.apAuthorities"),
          value: view.authorities.length > 0 ? view.authorities.map((row) => t("pty02.apAuthorityLine", { ref: row.reference, party: row.party.legalName, scope: scopeWords(row.premises, t), acts: actsWords(row.acts, t) })).join("; ") : null,
          missing: t("pty02.apNoAuthorities"),
        },
      ]}
      density="console"
      locale={locale}
    />
  );
}

function Loading({ t, locale }: { t: Translate; locale: Locale }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      <Columns layout="halves">
        <Panel title={t("pty02.party")} compact locale={locale}>
          <Skeleton variant="facts" rows={5} density="console" locale={locale} />
        </Panel>
        <Panel title={t("pty02.identification")} compact locale={locale}>
          <Skeleton variant="facts" rows={4} density="console" locale={locale} />
        </Panel>
      </Columns>
      <Panel title={t("pty02.premises")} compact locale={locale}>
        <Skeleton variant="table" rows={8} density="console" locale={locale} />
      </Panel>
      <Panel title={t("pty02.authorities")} compact locale={locale}>
        <Skeleton variant="table" rows={4} density="console" locale={locale} />
      </Panel>
    </div>
  );
}

/**
 * The premises portal's answer to a principal who opens a party page: their own party's authorities are where it leads
 * them; any other party is NOT_YOUR_PARTY, with the way back to their own (FR-PTY-007).
 */
async function NotYourParty({ principal, record, query }: { principal: Principal; record: string; query: SearchParams }) {
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = partyTranslator(locale);
  const own = (await loadPartyAuthorities(principal, null, null)).data?.party.record ?? null;
  if (own === record) redirect(routes.premisesPortfolio());
  return (
    <PortalShell fill layout={frame === "phone" ? "phone" : "desktop"} nav={premisesNav("premises", frame, locale)} account={principal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("party.portalPremises"), href: routes.premisesPortfolio() }]} title={t("pty02.genericTitle")} locale={locale} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
          <ViewState view="refused" refusal={{ ...refusal(t, "NOT_YOUR_PARTY", "pty02"), family: "attention" }} density="portal" locale={locale} />
          <Button variant="secondary" size="md" href={routes.premisesPortfolio()} fullWidth={frame === "phone"} locale={locale}>
            {t("pty02.backYours")}
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}

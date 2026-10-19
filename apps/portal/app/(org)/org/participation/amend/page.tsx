import { redirect } from "next/navigation";
import {
  ApprovalPair,
  Button,
  Columns,
  Comparison,
  Dialog,
  Divider,
  FactList,
  PageHeader,
  Panel,
  StatusLine,
  ViewState,
} from "@/components/r1";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { PortalShell } from "@/components/shells/PortalShell";
import { proposeAmendment } from "@/features/participation/actions";
import { AmendmentForm } from "@/features/participation/AmendmentForm";
import { scopeComparison, type Registers } from "@/features/participation/comparison";
import { day, listOf, partTranslator, rowLabel, rowPhrase, time } from "@/features/participation/copy";
import { readForPage } from "@/lib/api/flash";
import {
  REPERTOIRES,
  RIGHTS,
  TERRITORIES,
  loadAmendmentStep,
  loadParticipationStanding,
  type AmendmentAttempt,
  type AmendmentStep,
  type PendingAmendment,
} from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAT03_READERS, CAT03_VIEWS } from "@/lib/mock/participation";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

const REGISTERS: Registers = { rights: RIGHTS, repertoires: REPERTOIRES, territories: TERRITORIES };

/**
 * SCR-CAT-03 Scope amendment. The organisation proposes a prospective change to its active participation's
 * scope: rows to add, rows to close, a date after today. Submitted, the amendment waits for a legal approver
 * at the gateway (never the proposer, SEC-13) and SCR-CAT-02 lists it; no scope row changes until then.
 *
 * Entered from SCR-CAT-02's Propose a scope amendment, which is open only to an active participation; without
 * one the page goes back there, where the control says why.
 *
 * Review: `?view=` and `?reader=legal` draw the board's states, including the approver's (its Approve and its
 * confirmation are drawn and do nothing: the approvals surface is not built).
 */
export default async function AmendPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo)]);
  const t = partTranslator(locale);
  const view = reviewView(params, CAT03_VIEWS);
  const reader = reviewView({ view: params.reader }, CAT03_READERS);
  const reviewing = view !== null || reader !== null;
  const shown = view ?? "populated";

  const outcome = shown === "loading" ? null : await loadAmendmentStep(cmo, reviewing ? { view: shown } : null);
  if (!reviewing && outcome !== null && outcome.data === null && outcome.failure === null) redirect(routes.orgParticipation());
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const kept = readForPage<AmendmentAttempt>(params);
  const attempt = !reviewing && kept?.page === "amend" ? kept : null;
  const phone = frame === "phone";

  // The confirm state is the approver's: it draws the legal reader whatever the reader axis says.
  const confirm = shown === "confirm";
  const legal = reader === "legal" || confirm;
  const drafting = step !== null && !legal && (step.amendment === null || step.draft !== null);
  const amendment = step !== null && !drafting ? step.amendment : null;
  const organisation = step !== null ? step.participation.organisation : cmo.organisationName;
  const reference = step !== null ? step.participation.reference : standing.reference;

  return (
    <div style={{ position: "relative" }}>
      <PortalShell
        fill
        layout={phone ? "phone" : "desktop"}
        nav={legal ? [] : orgNav("participation", standing.open, locale)}
        account={legal ? (step?.legalReader ?? cmo.account) : cmo.account}
        context={orgContext(organisation, reference !== null ? t("part.context", { reference }) : t("part.contextNone"), locale)}
        {...(legal ? { surfaceLabel: t("part.surfaceLegal") } : {})}
        locale={locale}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
          <PageHeader
            crumbs={[{ label: t("part.crumb"), href: routes.orgParticipation() }]}
            title={t("part03.title")}
            {...(step !== null
              ? {
                  status: drafting ? { family: "neutral" as const, label: t("part.draft") } : { family: "attention" as const, label: t("part.awaiting") },
                  meta: amendment !== null ? submittedMeta(amendment, t, locale) : t("part03.metaDraft"),
                }
              : {})}
            locale={locale}
          />
          <ViewState
            view={shown === "loading" ? "loading" : failure === null ? "populated" : failure.code === "AMENDMENT_NOT_PENDING" ? "refused" : "error"}
            refusal={{ code: "AMENDMENT_NOT_PENDING", title: t("part03.refusedTitle"), text: t("part.refusal.AMENDMENT_NOT_PENDING"), family: "neutral" }}
            {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
            errorText={t("part03.errorText")}
            density="portal"
            rows={6}
            locale={locale}
          >
            {step !== null ? (
              <Columns single={phone}>
                {drafting ? (
                  <AmendmentForm
                    key={typeof params.attempt === "string" ? params.attempt : "new"}
                    action={proposeAmendment}
                    today={step.today}
                    current={step.current.map(({ right, repertoire, territory }) => ({ right, repertoire, territory }))}
                    registers={REGISTERS}
                    initial={
                      attempt !== null
                        ? { additions: attempt.additions, removals: attempt.removals, effectiveFrom: attempt.effectiveFrom }
                        : step.draft !== null
                          ? { additions: step.draft.additions, removals: step.draft.removals, effectiveFrom: step.draft.effectiveFrom }
                          : { additions: [], removals: [], effectiveFrom: null }
                    }
                    serverError={attempt !== null ? refusalAt(attempt, t) : null}
                    phone={phone}
                    locale={locale}
                  />
                ) : amendment !== null ? (
                  <Submitted step={step} amendment={amendment} waiting={!legal} phone={phone} t={t} locale={locale} />
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                  <Approval step={step} drafting={drafting} legal={legal} t={t} locale={locale} />
                </div>
              </Columns>
            ) : null}
          </ViewState>
        </div>
      </PortalShell>
      {confirm && step !== null && step.amendment !== null ? <ApproveDialog step={step} amendment={step.amendment} t={t} locale={locale} /> : null}
    </div>
  );
}

function submittedMeta(amendment: PendingAmendment, t: Translate, locale: Locale): string {
  return t("part03.meta", {
    reference: amendment.reference,
    name: amendment.preparedBy,
    time: time(amendment.preparedAt),
    date: day(amendment.preparedAt, locale),
  });
}

/** A refused proposal's code as the sentence under the field it names. */
function refusalAt(attempt: AmendmentAttempt, t: Translate): { field: string; text: string } | null {
  const { refusal } = attempt;
  if (refusal.code === "PARTICIPATION_NOT_ACTIVE") return null;
  if (refusal.code === "EFFECTIVE_FROM_IN_PAST") return { field: "effective_from", text: t("part.refusal.EFFECTIVE_FROM_IN_PAST") };
  const labels: Readonly<Record<string, string>> = {
    add_right: t("part03.right"),
    add_repertoire: t("part03.repertoire"),
    add_territory: t("part03.territory"),
    effective_from: t("part03.effLabel"),
  };
  const name = refusal.field.split(".")[0] ?? refusal.field;
  // Neither an addition nor a closing names no one field: the reason Submit gives for it says what is missing.
  if (refusal.field === "changes") return { field: "changes", text: t("part03.noChangeOff") };
  return { field: refusal.field, text: t("part.refusal.FIELD_MISSING", { field: labels[name] ?? name }) };
}

/** An amendment awaiting approval, read-only: what changes, the scope now and after, and the way back. */
function Submitted({
  step,
  amendment,
  waiting,
  phone,
  t,
  locale,
}: {
  step: AmendmentStep;
  amendment: PendingAmendment;
  waiting: boolean;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { rows, summary } = scopeComparison(REGISTERS, step.current, amendment.additions, amendment.removals, t, locale);
  return (
    <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      <Panel variant="plain" level={2} title={t("part03.changesTitle")} density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("part03.adds"), value: amendment.additions.length > 0 ? listOf(amendment.additions.map((key) => rowLabel(key, t)), locale) : null },
            {
              label: t("part03.closes"),
              value: amendment.removals.length > 0 ? listOf(amendment.removals.map((key) => rowLabel(key, t)), locale) : t("part03.closesNone"),
            },
            { label: t("part03.effLabel"), value: amendment.effectiveFrom, kind: "date" },
          ]}
          locale={locale}
        />
      </Panel>
      <Divider />
      <Panel variant="plain" level={2} title={t("part03.cmpCaption")} density="portal" locale={locale}>
        <Comparison
          caption={t("part03.cmpCaption")}
          rowLabel={t("part03.cmpRowLabel")}
          {...(summary !== null ? { summary } : {})}
          columns={[
            { key: "now", label: t("part03.cmpNow"), meta: day(step.today, locale) },
            { key: "after", label: t("part03.cmpAfter"), meta: t("part03.cmpAfterMeta", { date: day(amendment.effectiveFrom, locale) }) },
          ]}
          rows={rows}
          density="portal"
          locale={locale}
        />
      </Panel>
      {waiting ? (
        <div style={{ display: "flex" }}>
          <Button variant="secondary" size="md" fullWidth={phone} href={routes.orgParticipation()} locale={locale}>
            {t("part03.back")}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

/** Who prepared it, who must approve it, and where the reader stands (SEC-13 stated before any attempt). */
function Approval({ step, drafting, legal, t, locale }: { step: AmendmentStep; drafting: boolean; legal: boolean; t: Translate; locale: Locale }) {
  const amendment = step.amendment;
  const preparer = amendment !== null ? amendment.preparedBy : step.preparer;
  const position = legal
    ? {
        text: t("part03.positionLegal"),
        detail: t("part03.positionLegalDetail", { date: amendment !== null ? day(amendment.effectiveFrom, locale) : "" }),
      }
    : drafting
      ? { text: t("part03.positionDrafting"), detail: t("part03.positionDraftingDetail") }
      : { text: t("part03.positionSubmitted"), detail: t("part03.positionSubmittedDetail") };
  return (
    <Panel title={t("part03.approvalTitle")} density="portal" locale={locale}>
      <ApprovalPair
        preparer={{
          name: preparer,
          role: t("part03.preparerRole", { org: step.participation.shortName }),
          // A new amendment has not been sent yet, so it carries no time.
          ...(amendment !== null ? { at: amendment.preparedAt } : {}),
        }}
        approver={null}
        awaiting={t("part03.awaiting")}
        locale={locale}
      />
      <StatusLine family="info" text={position.text} detail={position.detail} cutout="surface" locale={locale} />
      {legal ? (
        <Button variant="primary" size="md" fullWidth locale={locale}>
          {t("part03.approve")}
        </Button>
      ) : null}
    </Panel>
  );
}

/** The approver's confirmation, drawn open for review only, over the page as the board places it. */
function ApproveDialog({ step, amendment, t, locale }: { step: AmendmentStep; amendment: PendingAmendment; t: Translate; locale: Locale }) {
  const date = day(amendment.effectiveFrom, locale);
  const org = step.participation.shortName;
  return (
    <Dialog
      title={t("part03.dlgTitle", { reference: amendment.reference, org })}
      description={t("part03.dlgText", { date, org, rows: listOf(amendment.additions.map((key) => rowPhrase(key, t)), locale) })}
      primaryAction={{ label: t("part03.dlgYes", { date }) }}
      secondaryAction={{ label: t("part03.dlgNo") }}
      open
      placement="overlay"
      autoFocus={false}
      locale={locale}
    />
  );
}

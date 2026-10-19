import { R1_FORMAT } from "@rightone/formatting";
import { redirect } from "next/navigation";
import {
  Banner,
  Breakdown,
  Button,
  Columns,
  ButtonRow,
  Divider,
  FactList,
  Link,
  PageHeader,
  Panel,
  QrCode,
  Skeleton,
  StatusLine,
  ViewState,
} from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { payByCard } from "@/features/finance/actions";
import { AuthorisePayment } from "@/features/finance/AuthorisePayment";
import { ReauthoriseBanner } from "@/features/finance/ReauthoriseBanner";
import { SaveQrCode } from "@/features/finance/SaveQrCode";
import { loadPayObligation, type PayAttempt, type PayObligation, type RightsLayer } from "@/lib/api/finance";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { FIN01_VIEWS } from "@/lib/mock/finance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import en from "@/messages/screens/fin.en.json";
import vi from "@/messages/screens/fin.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type Facts = Parameters<typeof FactList>[0]["items"];
type Failure = { code: string; traceId: string | null; retryable: boolean };

const LAYER_KEYS: Readonly<Record<RightsLayer, string>> = {
  authors: "fin01.authors",
  performers: "fin01.performers",
  producers: "fin01.producers",
};

/** The id of the wrapper around the phone's QR code, so Save the code can draw the same code. */
const CODE_ID = "fin01-transfer-code";

/**
 * SCR-FIN-01 Pay an obligation. Before an instruction exists the payer authorises payment of the decision;
 * once it exists, the page says how to pay it (the bank's QR code for a transfer, or a card) and for how long.
 * The decision's state says which: no instruction, an instruction to pay, one past its last day, or a decision
 * that cannot be paid. A decision already paid has nothing to pay here, and its payment position says how it
 * was paid.
 */
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ decision: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipal();
  const [{ decision }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, FIN01_VIEWS);
  const outcome = view === "loading" ? null : await loadPayObligation(principal.sessionId, decision, view);
  const attempt = view === null ? readForPage<PayAttempt>(query) : null;
  // A paid decision has nothing to pay: the page hands over to its payment position, unless it is answering an
  // act refused on it, which is drawn first; Reload the page then hands over.
  if (view === null && attempt === null && outcome?.data?.paid === true) redirect(routes.paymentPosition(decision));
  const data = answered(outcome?.data ?? null, attempt);
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const account = data?.reader?.account ?? principal.account;
  const notCurrent = data?.refusal?.code === "FIN_DECISION_NOT_CURRENT";

  const context =
    data !== null
      ? { premises: data.decision.premises, period: data.decision.reference, label: t("fin01.premisesLabel") }
      : { premises: principal.party, label: t("fin02.partyLabel") };
  const title =
    data === null
      ? t("fin01.titleGeneric")
      : t(notCurrent ? "fin01.titleDecision" : "fin01.title", { reference: data.decision.reference });
  const status = data !== null ? headerStatus(data, t) : null;

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("payments", frame, locale)}
      account={account}
      context={context}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("fin01.crumb"), href: routes.payments() }]}
          title={title}
          {...(status !== null ? { status } : {})}
          {...(data !== null ? { meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Loading frame={frame} t={t} locale={locale} />
        ) : failure !== null || data === null ? (
          <Failed failure={failure} phone={phone} t={t} locale={locale} />
        ) : (
          <Content data={data} confirming={view === "authorise-confirm"} frame={frame} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

/**
 * The page as the refused act left it. A repeated request is drawn where it was refused, on the page as the
 * payer had it when they pressed Authorise payment: the decision before an instruction, with the refusal under
 * the fee and Reload the page, which shows the decision as it stands now.
 */
function answered(data: PayObligation | null, attempt: PayAttempt | null): PayObligation | null {
  if (data === null || attempt?.refusal !== "FIN_IDEMPOTENCY_CONFLICT" || data.refusal !== null) return data;
  return { ...data, instruction: null, refusal: { code: attempt.refusal } };
}

function Failed({ failure, phone, t, locale }: { failure: Failure | null; phone: boolean; t: Translate; locale: Locale }) {
  if (failure?.code === "SRS_RESOURCE_NOT_ACCESSIBLE") {
    // A decision the reader may not see: the family's not-found wording, worded for the payment (FIN-02).
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
        <ViewState
          level={2}
          view="refused"
          refusal={{ code: failure.code, title: t("fin02.nfTitle"), text: t("fin02.nfText"), family: "attention" }}
          density="portal"
          locale={locale}
        />
        <div>
          <Button variant="secondary" size="md" icon="arrow-left" href={routes.payments()} fullWidth={phone} locale={locale}>
            {t("fin01.back")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ViewState
      level={2}
      view="error"
      errorTitle={t("fin01.errTitle")}
      errorText={t("fin01.errText")}
      {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure?.retryable ?? true}
      density="portal"
      locale={locale}
    />
  );
}

function Loading({ frame, t, locale }: { frame: Frame; t: Translate; locale: Locale }) {
  const narrow = frame !== "desktop";
  const inset = frame === "phone" ? "sm" : "md";
  return (
    <Columns single={narrow} gap={frame === "phone" ? 4 : 6}>
      <div style={{ display: "flex", flexDirection: "column", gap: frame === "phone" ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <Panel title={t("fin01.payTitle")} inset={inset} density="portal" locale={locale}>
            <Skeleton variant="card" rows={4} density="portal" locale={locale} />
          </Panel>
        </div>
        <div style={{ minWidth: 0 }}>
          <Panel inset={inset} density="portal" locale={locale}>
            <Skeleton variant="table" rows={4} columns={2} density="portal" locale={locale} />
          </Panel>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <Panel as="aside" title={t("fin01.instrTitle")} inset={inset} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={5} density="portal" locale={locale} />
        </Panel>
      </div>
    </Columns>
  );
}

function Content({
  data,
  confirming,
  frame,
  t,
  locale,
}: {
  data: PayObligation;
  confirming: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const { decision, instruction, refusal } = data;
  const phone = frame === "phone";
  const narrow = frame !== "desktop";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";
  const inset = phone ? "sm" : "md";
  const notCurrent = refusal?.code === "FIN_DECISION_NOT_CURRENT";
  const expired = instruction?.state === "expired";
  const paying = instruction?.state === "pending";
  // How to pay shows while the instruction can be paid; a replaced decision has no fee to pay here.
  const showPay = instruction !== null && !expired;
  const showFee = !notCurrent;
  const total = decision.components.reduce((sum, component) => sum + component.amountMinor, 0);
  const gridMax = notCurrent ? "var(--container-3xl)" : "none";

  return (
    <>
      {expired && (
        <div style={{ maxWidth: gridMax }}>
          <ReauthoriseBanner
            decision={decision.reference}
            title={t("fin01.exTitle", { date: R1_FORMAT.formatDate(instruction.validTo, locale) ?? "" })}
            text={t("fin01.exText")}
            label={t("fin01.exAgain")}
            fullWidth={phone}
            locale={locale}
          />
        </div>
      )}
      {notCurrent && decision.replacedBy !== null && (
        <div style={{ maxWidth: gridMax }}>
          <Banner
            family="attention"
            title={t("fin01.ncTitle")}
            code="FIN_DECISION_NOT_CURRENT"
            action={{
              label: t("fin01.openDecision", { reference: decision.replacedBy.reference }),
              href: routes.decision(decision.replacedBy.reference),
              variant: "secondary",
            }}
            density="portal"
            locale={locale}
          >
            {t("fin01.ncText")}
          </Banner>
        </div>
      )}
      <Columns single={narrow || notCurrent} gap={phone ? 4 : 6} style={{ maxWidth: gridMax }}>
        {(showPay || showFee) && (
          <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
            {showPay && (
              <div style={{ minWidth: 0 }}>
                <Panel title={t("fin01.payTitle")} gap="xl" inset={inset} density="portal" locale={locale}>
                  {!paying && (
                    <>
                      <Panel variant="plain" title={t("fin01.transferTitle")} level={3} density="portal" locale={locale}>
                        <Transfer data={data} total={total} phone={phone} t={t} locale={locale} />
                      </Panel>
                      <Divider />
                    </>
                  )}
                  <Panel variant="plain" title={t("fin01.cardTitle")} level={3} density="portal" locale={locale}>
                    <Text size="base" measure="xl">
                      {t("fin01.cardText")}
                    </Text>
                    {paying && <StatusLine family="info" text={t("fin01.payingLine")} locale={locale} />}
                    <form action={payByCard.bind(null, decision.reference)}>
                      <Button
                        variant="primary"
                        size="md"
                        icon="credit-card"
                        type="submit"
                        loading={paying}
                        loadingLabel={t("fin01.cardOpening")}
                        fullWidth={phone}
                        locale={locale}
                      >
                        {t("fin01.cardPay")}
                      </Button>
                    </form>
                  </Panel>
                </Panel>
              </div>
            )}
            {showFee && (
              <div style={{ minWidth: 0 }}>
                <Panel gap="xl" inset={inset} density="portal" locale={locale}>
                  <Breakdown
                    title={t("fin01.feeTitle")}
                    description={t(decision.outsideObligation ? "fin01.basisOut" : "fin01.feeDesc")}
                    lines={[
                      ...decision.components.map((component) => ({
                        label: t(LAYER_KEYS[component.layer]),
                        detail: decision.outsideObligation ? t("fin01.exempt") : t("fin01.recipient", { recipient: component.recipient }),
                        source: t("fin01.tariffSource", { version: decision.tariffVersion }),
                        amountMinor: component.amountMinor,
                      })),
                      { label: t("fin01.total"), kind: "total" as const, amountMinor: total },
                    ]}
                    currency="VND"
                    locale={locale}
                  />
                  <Act data={data} total={total} confirming={confirming} phone={phone} t={t} locale={locale} />
                </Panel>
              </div>
            )}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <Panel
            as={notCurrent ? "section" : "aside"}
            title={t(instruction !== null ? "fin01.instrTitle" : "fin01.decisionTitle")}
            inset={inset}
            density="portal"
            locale={locale}
          >
            <FactList items={facts(data, t, locale)} density="portal" locale={locale} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-2)" }}>
              {links(data, t).map((link) => (
                <Link key={link.label} href={link.href} variant="standalone" size="touch" locale={locale}>
                  {link.label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </Columns>
      <div>
        <Button variant="quiet" size="md" href={routes.payments()} fullWidth={phone} locale={locale}>
          {t("fin01.back")}
        </Button>
      </div>
    </>
  );
}

/** The bank transfer: the code beside its facts, or above Save the code on a phone. */
function Transfer({ data, total, phone, t, locale }: { data: PayObligation; total: number; phone: boolean; t: Translate; locale: Locale }) {
  const instruction = data.instruction;
  if (instruction === null) return null;
  const transferFacts: Facts = [
    { label: t("fin01.fContent"), value: instruction.transferContent, kind: "id" },
    { label: t("fin01.fAmount"), value: total, kind: "money" },
    { label: t("fin01.fHolder"), value: instruction.accountHolder },
  ];
  const code = (
    <QrCode
      value={instruction.qrPayload}
      size={160}
      label={t("fin01.qrLabel", { reference: instruction.reference })}
      locale={locale}
    />
  );
  if (phone) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
        <FactList items={transferFacts} density="portal" locale={locale} />
        <Text size="base">
          {t("fin01.scanPhone")}
        </Text>
        <div id={CODE_ID}>{code}</div>
        <SaveQrCode codeId={CODE_ID} fileName={`${instruction.reference}.png`} label={t("fin01.saveCode")} locale={locale} />
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "var(--space-6)", alignItems: "start" }}>
      <div>{code}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
        <FactList items={transferFacts} density="portal" locale={locale} />
        <Text size="base" measure="xl">
          {t("fin01.scan")}
        </Text>
      </div>
    </div>
  );
}

/** Under the fee: Authorise payment, or the refusal of it, which sits where the act was. */
function Act({
  data,
  total,
  confirming,
  phone,
  t,
  locale,
}: {
  data: PayObligation;
  total: number;
  confirming: boolean;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { decision, instruction, refusal } = data;
  if (instruction !== null) return null;
  if (refusal === null) {
    return (
      <div>
        <AuthorisePayment
          decision={decision.reference}
          label={t("fin01.authorise")}
          fullWidth={phone}
          initiallyOpen={confirming}
          dialog={{
            title: t("fin01.dlgTitle", { reference: decision.reference }),
            description: t("fin01.dlgText", { payer: decision.payer }),
            cancel: t("fin01.cancel"),
            width: phone ? "100%" : "var(--container-xl)",
            facts: [
              ...decision.components.map((component) => ({
                label: t(LAYER_KEYS[component.layer]),
                value: component.amountMinor,
                kind: "money" as const,
              })),
              { label: t("fin01.total"), value: total, kind: "money" as const },
              { label: t("fin01.fAuthority"), value: decision.collectionAuthority },
            ],
          }}
          locale={locale}
        />
      </div>
    );
  }
  switch (refusal.code) {
    case "FIN_IDEMPOTENCY_CONFLICT":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
          <Banner family="attention" title={t("fin01.idTitle")} code={refusal.code} density="portal" live locale={locale}>
            {t("fin01.idText")}
          </Banner>
          <ButtonRow>
            <Button variant="primary" size="md" disabled disabledReason={t("fin01.reloadFirst")} fullWidth={phone} locale={locale}>
              {t("fin01.authorise")}
            </Button>
            <Button variant="secondary" size="md" icon="refresh-cw" href={routes.pay(decision.reference)} fullWidth={phone} locale={locale}>
              {t("fin01.reload")}
            </Button>
          </ButtonRow>
        </div>
      );
    case "FIN_NO_PAYABLE_COMPONENT":
      return <Banner family="attention" title={t("fin01.nfeTitle")} code={refusal.code} density="portal" locale={locale} />;
    case "FIN_PAYMENT_NOT_AUTHORISED":
      return (
        <Banner family="attention" title={t("fin01.naTitle")} code={refusal.code} density="portal" locale={locale}>
          {t("fin01.naText", { principal: refusal.principal })}
        </Banner>
      );
    case "FIN_DECISION_NOT_CURRENT":
      return null;
  }
}

function headerStatus(data: PayObligation, t: Translate): { family: "neutral" | "attention" | "info"; label: string; working?: boolean } | null {
  switch (data.instruction?.state) {
    case "created":
      return { family: "neutral", label: t("fin01.created") };
    case "pending":
      return { family: "attention", label: t("fin01.pending"), working: true };
    case "expired":
      return { family: "neutral", label: t("fin01.expired") };
    case undefined:
      return data.refusal?.code === "FIN_DECISION_NOT_CURRENT" ? { family: "info", label: t("fin01.replaced") } : null;
  }
}

/**
 * The meta line states the page's moment: an instruction's last day, the time a view drawn at another
 * moment was read, or, for a decision the payer cannot pay, when it was issued.
 */
function meta(data: PayObligation, t: Translate, locale: Locale): string {
  const time = R1_FORMAT.formatTimestamp(data.asOf, locale) ?? "";
  const instruction = data.instruction;
  if (instruction !== null) {
    const date = R1_FORMAT.formatDate(instruction.validTo, locale) ?? "";
    if (instruction.state === "created") return t("fin01.metaInstr", { date });
    if (instruction.state === "pending") return t("fin01.metaPaying", { time, date });
    return t("fin01.asOf", { time });
  }
  const code = data.refusal?.code;
  if (code === "FIN_DECISION_NOT_CURRENT" || code === "FIN_NO_PAYABLE_COMPONENT") {
    return t("fin01.metaDecision", { time: R1_FORMAT.formatTimestamp(data.decision.issuedAt, locale) ?? "" });
  }
  return t("fin01.asOf", { time });
}

/** The aside: the instruction once it exists, otherwise the decision being paid. */
function facts(data: PayObligation, t: Translate, locale: Locale): Facts {
  const { decision, instruction, refusal } = data;
  const date = (iso: string) => R1_FORMAT.formatDate(iso, locale) ?? "";
  const payer = { label: t("fin01.fPayer"), value: decision.payer };
  const authority = { label: t("fin01.fAuthority"), value: decision.collectionAuthority, note: t("fin01.authorityNote") };
  const earlier =
    decision.earlierPayment !== null
      ? [
          {
            label: t("fin01.fEarlier"),
            value: decision.earlierPayment.reference,
            kind: "id" as const,
            note: t("fin01.earlierNote", { date: date(decision.earlierPayment.takenBackOn) }),
          },
        ]
      : [];
  const payBy = decision.payBy !== null ? [{ label: t("fin01.fPayBy"), value: decision.payBy, kind: "date" as const }] : [];

  if (instruction !== null) {
    return [
      { label: t("fin01.fRef"), value: instruction.reference, kind: "id" },
      payer,
      authority,
      {
        label: t("fin01.fAuthorised"),
        value: instruction.authorisedAt,
        kind: "datetime",
        note: t("fin01.authorisedBy", { person: instruction.authorisedBy }),
      },
      {
        label: t("fin01.fDecision"),
        value: decision.reference,
        kind: "id",
        ...(decision.payBy !== null ? { note: t("fin01.payByNote", { date: date(decision.payBy) }) } : {}),
      },
      ...earlier,
    ];
  }
  switch (refusal?.code) {
    case "FIN_DECISION_NOT_CURRENT":
      return [
        { label: t("fin01.fDecision"), value: decision.reference, kind: "id" },
        ...(decision.replacedBy !== null
          ? [
              {
                label: t("fin01.fReplacedBy"),
                value: decision.replacedBy.reference,
                kind: "id" as const,
                note: t("fin01.replacedNote", { date: date(decision.replacedBy.from) }),
              },
            ]
          : []),
        payer,
      ];
    case "FIN_NO_PAYABLE_COMPONENT":
      return [{ label: t("fin01.fDecision"), value: decision.reference, kind: "id" }, payer];
    case "FIN_PAYMENT_NOT_AUTHORISED":
      return [
        { label: t("fin01.fDecision"), value: decision.reference, kind: "id" },
        payer,
        authority,
        ...payBy,
        { label: t("fin01.fYourAuthority"), value: t("fin01.yourAuthority"), note: t("fin01.yourAuthorityNote") },
      ];
    case "FIN_IDEMPOTENCY_CONFLICT":
    case undefined:
      return [{ label: t("fin01.fDecision"), value: decision.reference, kind: "id" }, payer, authority, ...payBy, ...earlier];
  }
}

/** Open the decision (SCR-REG-08), and the earlier payment's position (SCR-FIN-02) where there is one. */
function links(data: PayObligation, t: Translate): { label: string; href: string }[] {
  const { decision, refusal } = data;
  const open = { label: t("fin01.openTheDecision"), href: routes.decision(decision.reference) };
  const offersEarlier = decision.earlierPayment !== null && (refusal === null || refusal.code === "FIN_IDEMPOTENCY_CONFLICT");
  return offersEarlier ? [open, { label: t("fin01.seeEarlier"), href: routes.paymentPosition(decision.reference) }] : [open];
}

import { Banner, Button, Checkbox, Disclosure, PageHeader, Panel, ScanView, Select, StatusLine, Table } from "@/components/r1";
import { refreshVerificationKeys, scanPrintout, uploadResult, verifyReference } from "@/features/inspection/actions";
import { DiscardableResults } from "@/features/inspection/DiscardableResults";
import { FieldFailure, FieldFrame } from "@/features/inspection/FieldFrame";
import { ReferenceForm } from "@/features/inspection/ReferenceForm";
import { RowActTable } from "@/features/inspection/RowActTable";
import { counted, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import {
  IDENTIFIER_TYPES,
  currentFieldDevice,
  loadScanAndVerify,
  resultKey,
  type ScanAndVerify,
  type ScanAttempt,
  type UploadedResult,
  type WaitingResult,
} from "@/lib/api/inspection";
import { readForPage } from "@/lib/api/flash";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER01_VIEWS } from "@/lib/mock/inspection";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** The longest reference the field takes (design/03 SCR-VER-01). */
const REFERENCE_LENGTH = 128;

/** The anchor the camera view's "type the code" leads to. */
const REFERENCE_ANCHOR = "reference";

/** The phone's own result, in the outcome words of section 5. */
const DEVICE_WORDS: Readonly<Record<WaitingResult["outcome"], string>> = {
  LIMITED_OFFLINE: "ver01.limited",
  NOT_AUTHENTICATED: "ver01.notAuthResult",
  UNABLE_TO_VERIFY: "ver01.noKeyResult",
};

/** RightOne's answer to an upload, other than a record in force, in the words of sections 5 and 5b. */
const UPLOADED_WORDS: Readonly<Record<Exclude<UploadedResult["state"], "IN_FORCE">, string>> = {
  REVOKED: "ver01.revoked",
  LIMITED_OFFLINE: "ver01.limited",
  NOT_AUTHENTICATED: "ver01.notAuthResult",
  NO_RECORD: "ver01.noRecordResult",
};

/**
 * SCR-VER-01 Scan and verify. The inspector scans the code on a certificate or types its reference, with or
 * without a network, and sees what waits on the phone to upload, what RightOne answered for what was uploaded,
 * and what could not be uploaded.
 */
export default async function ScanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Signed in as an inspector, or sent to sign in.
  const { sessionId } = await requireInspector();
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, VER01_VIEWS);
  // The inspection this screen verifies for (from SCR-VER-04), or a verification refused, kept by the act.
  const attempt = readForPage<ScanAttempt>(params);
  const outcome = view === "loading" ? null : await loadScanAndVerify(sessionId, view, attempt);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <FieldFrame device={data?.device ?? currentFieldDevice()} locale={locale}>
      <PageHeader title={t("ver01.title")} size="public" locale={locale} />
      {failure !== null ? (
        <FieldFailure failure={failure} refusals={["NOT_AUTHORISED"]} t={t} locale={locale} />
      ) : (
        <Scan data={data} openDiscard={view === "discard-confirm"} t={t} locale={locale} />
      )}
    </FieldFrame>
  );
}

function Scan({ data, openDiscard, t, locale }: { data: ScanAndVerify | null; openDiscard: boolean; t: Translate; locale: Locale }) {
  const loading = data === null;
  const refusal = data?.refusal ?? null;
  const offline = data?.device.network === "offline";
  const key = data?.device.verificationKey ?? null;
  const noKeys = key?.state === "missing";
  const actsWhy =
    refusal === "NO_EFFECTIVE_APPOINTMENT" ? t("ver.noAppointmentWhy") : refusal === "APPOINTMENT_SUSPENDED" ? t("ver.suspendedWhy") : null;
  const refreshWhy = offline ? t("ver01.needsNetwork") : actsWhy;
  const waiting = data?.waiting ?? [];
  const uploaded = data?.uploaded ?? [];
  const failed = data?.failed ?? [];
  const titled = (label: string, count: number) => (loading ? label : counted(t, label, count));
  const none = { variant: "governed", title: t("ver01.none"), action: false as const, level: 3 };
  const scannedCode = data?.scannedCode ?? null;
  // A printed record's code opens the record, which needs the network (design/03 SCR-VER-01, Scan).
  const scannedRecordOffline = offline && scannedCode?.startsWith("IRC-") === true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      {refusal !== null && (
        <Banner family="attention" title={refusalOf(t, refusal).title} code={refusal} density="portal" locale={locale}>
          {refusalOf(t, refusal).text}
        </Banner>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <KeysBanner data={data} t={t} locale={locale} />
        <form action={refreshVerificationKeys}>
          <Button
            type="submit"
            variant="secondary"
            size="md"
            icon="key-round"
            fullWidth
            {...(refreshWhy !== null ? { disabled: true, disabledReason: refreshWhy } : {})}
            locale={locale}
          >
            {t("ver01.refresh")}
          </Button>
        </form>
      </div>

      {data?.camera === "denied" && (
        <Banner family="info" title={t("ver01.cameraTitle")} density="portal" locale={locale}>
          {t("ver01.cameraText")}
        </Banner>
      )}
      {actsWhy === null && (
        <ScanView
          recordNoun={t("ver.recordNoun")}
          state={data?.camera ?? "scanning"}
          {...(scannedCode !== null ? { code: scannedCode } : {})}
          manualHref={`#${REFERENCE_ANCHOR}`}
          label={t("ver01.scanLabel")}
          locale={locale}
        />
      )}
      {actsWhy === null && data !== null && (
        // The web stand-in has no camera: it reads the code CER printed on the printout whose reference is typed.
        <Panel inset="sm" gap="md" density="portal" locale={locale}>
          {data.scan.noCode && <StatusLine family="attention" text={t("ver01.noCode", { r: data.scan.printout })} locale={locale} />}
          <ReferenceForm
            action={scanPrintout}
            field={{
              label: t("ver01.scanStandIn"),
              name: "printout",
              defaultValue: data.scan.printout,
              helper: t("ver01.scanStandInHelp"),
              maxLength: REFERENCE_LENGTH,
            }}
            button={{ label: t("ver01.scan"), variant: "secondary", size: "lg", icon: "qr-code" }}
            emptyReason={t("ver01.scanWhy")}
            blockedReason={null}
            failure={{ title: t("ver.errTitle"), text: t("ver.errText") }}
            locale={locale}
          >
            {data.inspection !== null && <input type="hidden" name="inspection" value={data.inspection} />}
            {/* With no key held, nothing can be checked offline (design/03 SCR-VER-01, Empty). */}
            {!noKeys && <Checkbox label={t("ver01.offlineCheck")} helper={t("ver01.offlineCheckHelp")} name="offline" value="on" density="portal" locale={locale} />}
          </ReferenceForm>
        </Panel>
      )}
      {data?.checking === true && (
        <Panel inset="sm" gap="sm" density="portal" locale={locale}>
          <StatusLine family="info" text={t("ver01.checking")} locale={locale} />
          <Button variant="secondary" size="md" icon="wifi-off" fullWidth locale={locale}>
            {t("ver01.checkOffline")}
          </Button>
        </Panel>
      )}
      {scannedRecordOffline && <StatusLine family="info" text={t("ver01.recordOffline")} locale={locale} />}

      <Panel inset="sm" gap="md" density="portal" locale={locale}>
        <ReferenceForm
          action={verifyReference}
          id={REFERENCE_ANCHOR}
          field={{
            label: t("ver01.reference"),
            name: "value",
            defaultValue: data?.typedReference ?? "",
            helper: t("ver01.prefixes"),
            ...(offline && !noKeys ? { info: t("ver01.typedOffline") } : {}),
            maxLength: REFERENCE_LENGTH,
            ...(actsWhy !== null ? { disabledReason: actsWhy } : {}),
          }}
          button={{ label: t("ver01.verify"), variant: "primary", size: "lg", icon: "shield-check" }}
          emptyReason={t("ver01.verifyWhy")}
          blockedReason={actsWhy}
          failure={{ title: t("ver.errTitle"), text: t("ver.errText") }}
          locale={locale}
        >
          {/* Verified from an open inspection, the answer attaches to it (design/03 SCR-VER-01, Acting for). */}
          {data !== null && data.inspection !== null && <input type="hidden" name="inspection" value={data.inspection} />}
          <Disclosure title={t("ver01.typeTitle")} density="portal" locale={locale}>
            <Select
              label={t("ver01.typeTitle")}
              name="identifier_type"
              options={IDENTIFIER_TYPES.map((type) => ({ value: type, label: t(`ver.identifierType.${type}`) }))}
              placeholder={t("ver01.typeAuto")}
              density="portal"
              locale={locale}
            />
          </Disclosure>
        </ReferenceForm>
      </Panel>

      <Panel title={titled(t("ver01.waiting"), waiting.length)} level={2} inset="sm" density="portal" locale={locale}>
        <RowActTable
          columns={[
            { key: "rep", label: t("ver01.cRep"), kind: "id" },
            { key: "res", label: t("ver01.cDevice"), kind: "status" },
            { key: "at", label: t("ver01.cAt"), kind: "datetime" },
            { key: "act", kind: "actions" },
          ]}
          rows={waiting.map((row) => ({
            key: resultKey(row),
            cells: {
              // A read RightOne could not make leaves the result waiting, with the reason on its row.
              ...(row.refusal !== null ? { _message: { severity: "warning", text: refusalSentence(t, row.refusal), code: row.refusal } } : {}),
              rep: row.representation,
              // The phone's result in the outcome words of section 5, never a code.
              res: { family: "attention", label: t(DEVICE_WORDS[row.outcome]) },
              at: row.checkedAt,
            },
            act: {
              label: t("ver01.upload"),
              ariaLabel: `${t("ver01.upload")} ${row.representation}`,
              icon: "upload",
              ...(offline ? { disabledReason: t("ver01.uploadOffline") } : {}),
            },
          }))}
          action={uploadResult}
          loading={loading ? 1 : false}
          caption={titled(t("ver01.waiting"), waiting.length)}
          empty={none}
          locale={locale}
        />
      </Panel>

      <Panel title={titled(t("ver01.uploaded"), uploaded.length)} level={2} inset="sm" density="portal" locale={locale}>
        <Table
          columns={[
            { key: "ans", label: t("ver01.cAnswer"), kind: "id" },
            { key: "res", label: t("ver01.cResult"), kind: "status" },
            { key: "at", label: t("ver01.cAt"), kind: "datetime" },
            { key: "act", kind: "actions" },
          ]}
          rows={uploaded.map((row) => ({
            _key: row.answer,
            // RightOne's own outcome; where it is not what the phone said, the row says so.
            ...(row.refusal !== null
              ? { _message: { severity: "warning", text: refusalSentence(t, row.refusal), code: row.refusal } }
              : row.notAttached !== null
                ? { _message: { severity: "neutral", text: t("ver01.notAttached", { r: refusalOf(t, row.notAttached).title }), code: row.notAttached } }
                : row.differsFromDevice
                  ? { _message: { severity: "neutral", text: t("ver01.differs") } }
                  : {}),
            ans: row.answer,
            res:
              row.state === "IN_FORCE"
                ? { family: "info", label: t("ver.inForce"), variant: "seal" }
                : { family: "attention", label: t(UPLOADED_WORDS[row.state]) },
            at: row.checkedAt,
            act: [
              {
                label: t("ver01.openRow"),
                ariaLabel: `${t("ver01.openRow")} ${row.answer}`,
                variant: "secondary",
                href: routes.fieldAnswer(row.answer),
              },
            ],
          }))}
          loading={loading ? 1 : false}
          layout="cards"
          density="portal"
          caption={titled(t("ver01.uploaded"), uploaded.length)}
          empty={none}
          locale={locale}
        />
      </Panel>

      <Panel title={titled(t("ver01.failed"), failed.length)} level={2} inset="sm" density="portal" locale={locale}>
        <DiscardableResults
          columns={[
            { key: "rep", label: t("ver01.cRep"), kind: "id" },
            { key: "at", label: t("ver01.cAt"), kind: "datetime" },
            { key: "act", kind: "actions" },
          ]}
          rows={failed.map((row) => ({
            key: resultKey(row),
            cells: {
              _message: { severity: "warning", text: refusalSentence(t, row.refusal), code: row.refusal },
              rep: row.representation,
              at: row.checkedAt,
            },
            facts: [
              { label: t("ver01.cRep"), value: row.representation, kind: "mono" },
              { label: t("ver01.cAt"), value: row.checkedAt, kind: "datetime" },
            ],
            discardLabel: t("ver01.discard"),
            discardAriaLabel: `${t("ver01.discard")} ${row.representation}`,
          }))}
          caption={titled(t("ver01.failed"), failed.length)}
          loading={loading ? 1 : false}
          empty={none}
          dialog={{ title: t("ver01.dlgTitle"), description: t("ver01.dlgText"), discard: t("ver01.discard"), cancel: t("ver.cancel") }}
          openRow={openDiscard && failed[0] !== undefined ? resultKey(failed[0]) : null}
          locale={locale}
        />
      </Panel>

      <Button variant="quiet" size="md" icon="arrow-left" fullWidth href={routes.field()} locale={locale}>
        {t("ver.home")}
      </Button>
    </div>
  );
}

/** The keys' line: about to stop working offline, none held yet, or unreadable just now (P1). */
function KeysBanner({ data, t, locale }: { data: ScanAndVerify | null; t: Translate; locale: Locale }) {
  const key = data?.device.verificationKey ?? null;
  const keysRefusal = data?.keysRefusal ?? null;
  if (keysRefusal !== null) {
    const refusal = refusalOf(t, keysRefusal);
    return (
      <Banner family="attention" title={refusal.title} code={refusal.code} density="portal" locale={locale}>
        {refusal.text}
      </Banner>
    );
  }
  if (key?.state === "expiring") {
    return (
      <Banner family="attention" title={t("ver01.expiringTitle", { t: timestamp(key.until, locale) })} density="portal" locale={locale}>
        {t("ver01.expiringText")}
      </Banner>
    );
  }
  if (key?.state === "missing") {
    return (
      <Banner family="info" title={t("ver01.noKeysTitle")} density="portal" locale={locale}>
        {t("ver01.noKeysText")}
      </Banner>
    );
  }
  return null;
}

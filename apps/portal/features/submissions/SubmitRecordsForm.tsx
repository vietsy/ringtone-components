"use client";

import { R1_FORMAT } from "@rightone/formatting";
import { useEffect, useState, useTransition } from "react";
import { Button, ButtonRow, Columns, Divider, FactList, FileUpload, Panel, Select } from "@/components/r1";
import { Text } from "@/components/Text";
import type { ExchangeFormat, SubmitEntered } from "@/lib/api/submissions";
import type { Locale } from "@/lib/i18n/translate";
import { stageSubmissionPart, submitRecords } from "./actions";
import { fill, sizeParts } from "./sizes";

/** SCR-CAT-04's words, from the page's catalogue; templates keep their `{count}`, `{sent}` and `{total}`. */
export interface SubmitCopy {
  channelTitle: string;
  channel: string;
  channelHelp: string;
  format: string;
  formatHelp: string;
  payloadTitle: string;
  file: string;
  fileHelp: string;
  countLabel: string;
  records: string;
  ceilingLabel: string;
  ceiling: string;
  submit: string;
  submitOne: string;
  submitAny: string;
  submitting: string;
  submittingAny: string;
  cancel: string;
  stSend: string;
  stSendDetail: string;
  stRef: string;
  stRefDetail: string;
  noFile: string;
  tooLarge: string;
  chanRefused: string;
  submitOffBig: string;
  submitOffChan: string;
  submitOffFile: string;
  sizeMb: string;
  sizeKb: string;
  missing: { channel: string; format: string; file: string };
}

interface Chosen {
  name: string;
  type: string;
  sizeBytes: number;
  records: number | null;
  /** The upload a refused attempt left on the server, sent again without choosing the file again. */
  upload: string | null;
  /** The file chosen here, read in the browser to count it and sent in parts. */
  blob: File | null;
}

/** A server action takes at most 1 MB a request; each part stays well under it. */
const PART_BYTES = 512 * 1024;

/**
 * The records of a JSON payload, counted when the file is chosen, as the spec's Record count is ("computed on
 * select"): the file's `records[]`, or the file itself when it is the array. The server reads and counts it
 * again. The CSV profile does not say how its rows map to records, so a CSV file is not counted.
 */
async function countRecords(file: File, format: ExchangeFormat): Promise<number | null> {
  if (format !== "json") return null;
  try {
    const parsed: unknown = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
    const records = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null ? (parsed as { records?: unknown }).records : null;
    return Array.isArray(records) ? records.length : null;
  } catch {
    return null;
  }
}

/**
 * SCR-CAT-04's form: channel and format, the records file, Submit and Cancel. The file is counted when chosen;
 * a file above the ceiling or an unagreed channel is refused on the spot, as the board draws it, and Submit
 * says why it waits. Submit sends the file in parts and then the submission; the server reads the file again
 * and either opens SCR-CAT-05 on the new reference or brings the form back with its refusal.
 *
 * Locked (a suspended participation, or none), the fields are disabled and no file can be chosen.
 */
export function SubmitRecordsForm({
  copy,
  channels,
  formats,
  ceiling,
  entered,
  sending,
  drawn,
  locked,
  cancelHref,
  phone,
  locale,
}: {
  copy: SubmitCopy;
  channels: readonly { value: string; label: string; agreed: boolean; format: ExchangeFormat | null }[];
  formats: readonly { value: ExchangeFormat; label: string }[];
  ceiling: number;
  entered: SubmitEntered | null;
  /** The canvas's submitting view: the file part-way up. */
  sending: { sentBytes: number } | null;
  /** A review state: the canvas's file is drawn though none is held, and Submit is drawn as the board draws it. */
  drawn: boolean;
  locked: { reason: string } | null;
  cancelHref: string;
  phone: boolean;
  locale: Locale;
}) {
  const firstAgreed = channels.find((channel) => channel.agreed);
  const profileOf = (code: string) => channels.find((channel) => channel.value === code)?.format ?? null;
  const initialChannel = entered?.channel ?? firstAgreed?.value ?? "";
  const [channel, setChannel] = useState(initialChannel);
  const [format, setFormat] = useState<ExchangeFormat>(entered?.format ?? profileOf(initialChannel) ?? "json");
  const [file, setFile] = useState<Chosen | null>(entered?.file !== undefined && entered.file !== null ? { ...entered.file, blob: null } : null);
  const [refusal, setRefusal] = useState(entered?.refusal ?? null);
  const [sent, setSent] = useState<number | null>(sending?.sentBytes ?? null);
  const [pending, startSending] = useTransition();

  // Count the chosen file whenever it or the format changes.
  const blob = file?.blob ?? null;
  useEffect(() => {
    if (blob === null) return undefined;
    let current = true;
    void countRecords(blob, format).then((records) => {
      if (current) setFile((before) => (before !== null && before.blob === blob ? { ...before, records } : before));
    });
    return () => {
      current = false;
    };
  }, [blob, format]);

  const count = (value: number) => R1_FORMAT.formatCount(value, locale) ?? "";
  const size = (bytes: number) => {
    const { value, unit } = sizeParts(bytes, locale);
    return fill(unit === "MB" ? copy.sizeMb : copy.sizeKb, { size: value });
  };

  const chosen = channels.find((option) => option.value === channel) ?? null;
  const channelRefused = chosen !== null && !chosen.agreed;
  const channelError = channelRefused
    ? copy.chanRefused
    : refusal?.field === "channel"
      ? refusal.code === "FIELD_MISSING"
        ? copy.missing.channel
        : copy.chanRefused
      : null;
  const profile = chosen?.format ?? null;
  const formatOptions = profile !== null ? formats.filter((option) => option.value === profile) : formats;
  const formatError = refusal?.field === "format" ? copy.missing.format : null;
  const records = file?.records ?? null;
  const tooLarge = records !== null && records > ceiling;
  const fileError =
    tooLarge || (refusal?.field === "file" && refusal.code === "PAYLOAD_TOO_LARGE") ? copy.tooLarge : refusal?.field === "file" ? copy.missing.file : null;
  const sendable = file !== null && (drawn || file.blob !== null || file.upload !== null);
  const submitting = pending || sending !== null;

  const reason =
    locked?.reason ??
    (channelRefused ? copy.submitOffChan : null) ??
    (tooLarge ? fill(copy.submitOffBig, { count: count(records) }) : null) ??
    (sendable ? null : copy.submitOffFile);
  const label =
    records === null ? copy.submitAny : records === 1 ? copy.submitOne : fill(copy.submit, { count: count(records) });
  const busyLabel = records === null ? copy.submittingAny : fill(copy.submitting, { count: count(records) });

  const stages =
    submitting && file !== null && sent !== null
      ? (() => {
          const total = sizeParts(file.sizeBytes, locale);
          const scale = total.unit === "MB" ? 1_000_000 : 1000;
          const sentText = R1_FORMAT.nf(locale, total.unit === "MB" ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(sent / scale);
          return [
            { label: copy.stSend, state: "current" as const, detail: fill(copy.stSendDetail, { sent: sentText, total: size(file.sizeBytes) }) },
            { label: copy.stRef, state: "todo" as const, detail: copy.stRefDetail },
          ];
        })()
      : [];

  const choose = (files: FileList) => {
    const picked = files[0];
    if (picked === undefined) return;
    setRefusal((before) => (before?.field === "file" ? null : before));
    setFile({ name: picked.name, type: picked.type, sizeBytes: picked.size, records: null, upload: null, blob: picked });
  };

  const send = () => {
    if (file === null) return;
    const current = file;
    startSending(async () => {
      let upload = current.upload;
      if (current.blob !== null) {
        upload = null;
        setSent(0);
        for (let offset = 0; offset === 0 || offset < current.blob.size; offset += PART_BYTES) {
          const part = new FormData();
          part.set("upload", upload ?? "");
          part.set("part", current.blob.slice(offset, offset + PART_BYTES));
          const answer = await stageSubmissionPart(part);
          if (answer.upload === null) {
            setRefusal({ code: "PAYLOAD_TOO_LARGE", field: "file" });
            setSent(null);
            return;
          }
          upload = answer.upload;
          setSent(Math.min(offset + PART_BYTES, current.blob.size));
        }
      }
      const form = new FormData();
      form.set("channel", channel);
      form.set("format", format);
      form.set("upload", upload ?? "");
      form.set("name", current.name);
      form.set("type", current.type);
      await submitRecords(form);
    });
  };

  const off = locked !== null;
  return (
    <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      <Panel variant="plain" level={2} title={copy.channelTitle} density="portal" locale={locale}>
        <Columns layout="halves" single={phone}>
          <Select
            label={copy.channel}
            helper={copy.channelHelp}
            options={channels.map(({ value, label: text }) => ({ value, label: text }))}
            value={channel}
            required
            name="channel"
            {...(channelError !== null ? { error: channelError } : {})}
            disabled={off}
            onChange={(value: string) => {
              setChannel(value);
              setRefusal((before) => (before?.field === "channel" || before?.field === "format" ? null : before));
              const profile = profileOf(value);
              if (profile !== null) setFormat(profile);
            }}
            locale={locale}
          />
          <Select
            label={copy.format}
            helper={copy.formatHelp}
            options={formatOptions.map(({ value, label: text }) => ({ value, label: text }))}
            value={format}
            required
            name="format"
            {...(formatError !== null ? { error: formatError } : {})}
            disabled={off}
            onChange={(value: string) => {
              setFormat(value === "csv" ? "csv" : "json");
              setRefusal((before) => (before?.field === "format" ? null : before));
            }}
            locale={locale}
          />
        </Columns>
      </Panel>
      <Divider />
      <Panel variant="plain" level={2} title={copy.payloadTitle} density="portal" locale={locale}>
        {off ? (
          <Text size="base" tone="secondary">
            {copy.noFile}
          </Text>
        ) : (
          <>
            <FileUpload
              density="portal"
              label={copy.file}
              helper={copy.fileHelp}
              required
              accept=".json,.csv"
              {...(file !== null ? { fileName: file.name, fileSize: size(file.sizeBytes) } : {})}
              stages={stages}
              {...(fileError !== null ? { error: fileError } : {})}
              onFiles={choose}
              {...(submitting ? {} : { onReplace: choose, onRemove: () => setFile(null) })}
              locale={locale}
            />
            <FactList
              items={[
                { label: copy.countLabel, value: records === null ? null : fill(copy.records, { count: count(records) }) },
                { label: copy.ceilingLabel, value: copy.ceiling },
              ]}
              locale={locale}
            />
          </>
        )}
      </Panel>
      <ButtonRow>
        <Button
          variant="primary"
          size="md"
          icon="upload"
          loading={submitting}
          loadingLabel={busyLabel}
          disabled={reason !== null}
          {...(reason !== null ? { disabledReason: reason } : {})}
          fullWidth={phone}
          onClick={send}
          locale={locale}
        >
          {label}
        </Button>
        <Button variant="quiet" size="md" href={cancelHref} fullWidth={phone} locale={locale}>
          {copy.cancel}
        </Button>
      </ButtonRow>
    </Panel>
  );
}

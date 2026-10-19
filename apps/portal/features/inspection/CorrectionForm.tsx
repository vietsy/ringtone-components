"use client";

import { useRef, useState, type ComponentProps } from "react";
import {
  Button,
  ButtonRow,
  Columns,
  Dialog,
  Divider,
  FactList,
  FieldRow,
  FieldRows,
  Panel,
  Select,
  StatusLine,
  TextField,
} from "@/components/r1";
import type { Family } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { FollowUpFields } from "./FollowUpFields";
import { OutcomeFields } from "./OutcomeFields";
import { useHydrated } from "./ShortcutButton";

type Options = ComponentProps<typeof Select>["options"];
type OutcomeProps = ComponentProps<typeof OutcomeFields>;
type FollowUpProps = ComponentProps<typeof FollowUpFields>;

interface FindingRow {
  key: string;
  kind: string;
  note: string;
}

interface Props {
  action: (form: FormData) => Promise<void>;
  record: string;
  caseField: { label: string; title: string; value: string; error: string | null; line: { family: Family; text: string } };
  outcome: Pick<OutcomeProps, "outcome" | "refusal" | "guidance" | "referral"> & { title: string };
  findings: {
    legend: string;
    rowTitle: string;
    add: string;
    kind: string;
    note: string;
    kinds: Options;
    rows: readonly { kind: string; note: string }[];
    /** The kinds a note is needed for, and NOTE_REQUIRED's sentence when the last send was refused for it. */
    needNote: readonly string[];
    noteError: string | null;
  };
  followUp: Pick<FollowUpProps, "kind" | "date">;
  reason: { label: string; value: string };
  issue: { label: string; barred: string | null };
  cancel: { label: string; href: string };
  confirm: { title: string; description: string; record: string; outcome: string; case: string };
  locale: Locale;
}

/**
 * SCR-VER-15's correction: the case it is made under, the corrected outcome and findings as at conclusion, the
 * follow-up and the reason. The findings are rows the inspector adds and removes. Issue asks for confirmation,
 * naming the record, the outcome and the case, then sends; the server decides (DR-747, DR-741).
 */
export function CorrectionForm({ action, record, caseField, outcome, findings, followUp, reason, issue, cancel, confirm, locale }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const made = useRef(findings.rows.length);
  const [rows, setRows] = useState<FindingRow[]>(() => findings.rows.map((row, index) => ({ ...row, key: `finding-${String(index)}` })));
  const [confirming, setConfirming] = useState<{ outcome: string; caseRef: string } | null>(null);
  const hydrated = useHydrated();
  const change = (key: string, patch: Partial<FindingRow>) => setRows((before) => before.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const add = () => {
    made.current += 1;
    setRows((before) => [...before, { key: `finding-${String(made.current)}`, kind: "", note: "" }]);
  };
  /** What the confirmation names: the outcome and the case as the form holds them when Issue is pressed. */
  const named = () => {
    const sent = form.current === null ? null : new FormData(form.current);
    const chosen = sent?.get("outcome");
    const caseRef = sent?.get("case_ref");
    return {
      outcome: outcome.outcome.options.find((option) => option.value === chosen)?.label ?? "",
      caseRef: typeof caseRef === "string" ? caseRef : caseField.value,
    };
  };

  return (
    <form ref={form} action={action} style={{ display: "contents" }}>
      <input type="hidden" name="record" value={record} />
      <Panel variant="plain" title={caseField.title} level={2} gap="md" density="console" locale={locale}>
        <TextField
          label={caseField.label}
          name="case_ref"
          mono
          value={caseField.value}
          required
          {...(caseField.error !== null ? { error: caseField.error } : {})}
          width="var(--space-72)"
          density="console"
          locale={locale}
        />
        <StatusLine family={caseField.line.family} text={caseField.line.text} locale={locale} />
      </Panel>
      <Divider />
      <Panel variant="plain" title={outcome.title} level={2} gap="md" density="console" locale={locale}>
        <OutcomeFields
          outcome={outcome.outcome}
          refusal={outcome.refusal}
          guidance={outcome.guidance}
          referral={outcome.referral}
          density="console"
          layout="inline"
          locale={locale}
        />
        <FieldRows legend={findings.legend} count={rows.length} addLabel={findings.add} onAdd={add} density="console" locale={locale}>
          {rows.map((row, index) => (
            <FieldRow
              key={row.key}
              title={findings.rowTitle.replace("{n}", String(index + 1))}
              columns={2}
              removable
              onRemove={() => setRows((before) => before.filter((entry) => entry.key !== row.key))}
              density="console"
              locale={locale}
            >
              <Select
                label={findings.kind}
                name="finding_kind"
                options={findings.kinds}
                {...(row.kind !== "" ? { value: row.kind } : {})}
                onChange={(kind) => change(row.key, { kind })}
                required
                density="console"
                locale={locale}
              />
              <TextField
                label={findings.note}
                name="note"
                value={row.note}
                onChange={(note) => change(row.key, { note })}
                {...(findings.noteError !== null && findings.needNote.includes(row.kind) && row.note === "" ? { error: findings.noteError } : {})}
                density="console"
                locale={locale}
              />
            </FieldRow>
          ))}
        </FieldRows>
        <Columns layout="halves" gap={4}>
          <FollowUpFields kind={followUp.kind} date={followUp.date} density="console" locale={locale} />
        </Columns>
      </Panel>
      <Divider />
      <TextField label={reason.label} name="correction_reason" value={reason.value} multiline rows={3} required maxLength={1000} density="console" locale={locale} />
      <ButtonRow>
        <Button
          variant="primary"
          size="sm"
          icon="file-check"
          {...(hydrated ? { shortcut: "Alt+I" } : {})}
          {...(issue.barred !== null ? { disabled: true, disabledReason: issue.barred } : {})}
          onClick={() => setConfirming(named())}
          locale={locale}
        >
          {issue.label}
        </Button>
        <Button variant="quiet" size="sm" href={cancel.href} locale={locale}>
          {cancel.label}
        </Button>
      </ButtonRow>
      {confirming !== null && (
        <Dialog
          title={confirm.title}
          description={confirm.description}
          primaryAction={{ label: issue.label, variant: "primary", onClick: () => form.current?.requestSubmit() }}
          secondaryAction={{ label: cancel.label, onClick: () => setConfirming(null) }}
          onClose={() => setConfirming(null)}
          open
          placement="overlay"
          align="start"
          density="console"
          locale={locale}
        >
          <FactList
            items={[
              { label: confirm.record, value: record, kind: "id" },
              { label: confirm.outcome, value: confirming.outcome === "" ? null : confirming.outcome },
              { label: confirm.case, value: confirming.caseRef, kind: "id" },
            ]}
            density="console"
            locale={locale}
          />
        </Dialog>
      )}
    </form>
  );
}

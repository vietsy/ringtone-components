"use client";

import { useRef, useState } from "react";
import { Banner, ChoiceList, Dialog, FactList, Select, Table } from "@/components/r1";
import type { AssessInput } from "@/lib/api/player";
import type { Locale } from "@/lib/i18n/translate";
import { assessCertification } from "./actions";

type Column = { key: string; label: string; kind?: "strong" | "status"; nowrap?: boolean };

/**
 * SCR-PLR-10 on the evidence console: the register, and Assess on each application still waiting for an outcome.
 * The outcome is recorded against the criteria version the application was lodged under; a refusal names the
 * criterion not met, because a refusal with no ground is itself refused.
 */
export function AssessRegister({
  columns,
  rows,
  waiting,
  criteria,
  reopen,
  caption,
  sortNote,
  words,
  locale,
}: {
  columns: readonly Column[];
  rows: readonly Record<string, unknown>[];
  /** The applications that wait for an outcome, by id: what the dialogue names. */
  waiting: Readonly<Record<string, { supplier: string; version: string; lodged: string }>>;
  criteria: readonly string[];
  /** A refused assessment, which reopens its dialogue with the refusal and what was chosen. */
  reopen: { id: string; values: AssessInput; refusal: { code: string; title: string; text: string } | null; outcomeError: string | null } | null;
  caption: string;
  sortNote: string;
  words: {
    action: string;
    title: string;
    text: string;
    fSupplier: string;
    fVersion: string;
    fLodged: string;
    outcome: string;
    certified: string;
    refused: string;
    criterion: string;
    chooseCriterion: string;
    criterionOption: string;
    submit: string;
    keep: string;
  };
  locale: Locale;
}) {
  const [id, setId] = useState<string | null>(reopen?.id ?? null);
  const [outcome, setOutcome] = useState(reopen?.values.outcome ?? "");
  const [criterion, setCriterion] = useState(reopen?.values.criterion ?? "");
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const chosen = id === null ? null : (waiting[id] ?? null);
  const fill = (template: string) => template.replace("{s}", chosen?.supplier ?? "").replace("{v}", chosen?.version ?? "");
  const shown = reopen !== null && reopen.id === id;

  return (
    <>
      <Table
        columns={[...columns, { key: "act", kind: "actions" }]}
        rows={rows.map((row) => {
          const key = String(row._key);
          const entry = waiting[key];
          return {
            ...row,
            act:
              entry === undefined
                ? []
                : [
                    {
                      label: words.action,
                      ariaLabel: `${words.action} ${entry.supplier}`,
                      variant: "quiet",
                      onClick: () => {
                        setOutcome("");
                        setCriterion("");
                        setId(key);
                      },
                    },
                  ],
          };
        })}
        density="console"
        caption={caption}
        sortNote={sortNote}
        rowFocus
        locale={locale}
      />
      {id !== null ? (
        <form ref={form} action={assessCertification.bind(null, id)} style={{ display: "none" }}>
          <input type="hidden" name="outcome" value={outcome} />
          <input type="hidden" name="refusal_criterion" value={outcome === "refused" ? criterion : ""} />
        </form>
      ) : null}
      {id !== null && chosen !== null ? (
        <Dialog
          title={fill(words.title)}
          description={fill(words.text)}
          primaryAction={{
            label: words.submit,
            variant: "primary",
            loading: sending,
            onClick: () => {
              setSending(true);
              form.current?.requestSubmit();
            },
          }}
          secondaryAction={{ label: words.keep, onClick: () => setId(null) }}
          onClose={() => setId(null)}
          open
          placement="viewport"
          align="start"
          autoFocus={false}
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          {shown && reopen !== null && reopen.refusal !== null ? (
            <Banner family="neutral" title={reopen.refusal.title} code={reopen.refusal.code} compact density="console" locale={locale}>
              {reopen.refusal.text}
            </Banner>
          ) : null}
          <FactList
            items={[
              { label: words.fSupplier, value: chosen.supplier },
              { label: words.fVersion, value: chosen.version },
              { label: words.fLodged, value: chosen.lodged, kind: "date" },
            ]}
            density="console"
            locale={locale}
          />
          <ChoiceList
            legend={words.outcome}
            options={[
              { value: "certified", label: words.certified, family: "positive" },
              { value: "refused", label: words.refused, family: "danger" },
            ]}
            {...(outcome !== "" ? { value: outcome } : {})}
            onChange={(event) => setOutcome((event as { target: { value: string } }).target.value)}
            required
            {...(shown && reopen !== null && reopen.outcomeError !== null ? { error: reopen.outcomeError } : {})}
            density="console"
            locale={locale}
          />
          {outcome === "refused" ? (
            <Select
              label={words.criterion}
              options={criteria.map((value) => ({ value, label: words.criterionOption.replace("{c}", value) }))}
              {...(criterion !== "" ? { value: criterion } : {})}
              placeholder={words.chooseCriterion}
              onChange={setCriterion}
              required
              density="console"
              locale={locale}
            />
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}

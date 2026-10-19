"use client";

import { useRef, useState, type ComponentProps } from "react";
import { Dialog, FactList, Table, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Columns = ComponentProps<typeof Table>["columns"];

export interface KeyRow {
  kid: string;
  /** The row's cells as the server page builds them. */
  cells: Record<string, unknown>;
  canRetire: boolean;
  canRevoke: boolean;
  /** A refusal of the last act on this row, said in place of its actions. */
  refusal: { message: string; code: string } | null;
  /** What the confirmation restates: when it signs from, and how many printouts it signed. */
  facts: readonly { label: string; value: unknown; kind?: "datetime" }[];
}

interface Props {
  columns: Columns;
  rows: readonly KeyRow[];
  /** Null for a reader who may not act on keys: the table has no actions. */
  acts: {
    retire: (form: FormData) => Promise<void>;
    revoke: (form: FormData) => Promise<void>;
  } | null;
  /** The key whose revocation came back without its reason: its confirmation opens again, with the refusal. */
  reopenRevoke: { kid: string; error: string } | null;
  words: {
    retire: string;
    revoke: string;
    cancel: string;
    retireTitle: string;
    retireText: string;
    retireYes: string;
    revokeTitle: string;
    revokeText: string;
    revokeYes: string;
    reason: string;
    reasonHelp: string;
  };
  caption: string;
  sortNote: string;
  loading: number | false;
  locale: Locale;
}

const fill = (template: string, kid: string) => template.replace("{kid}", kid);

/**
 * SCR-CER-10's keys with Retire and Revoke on each row they apply to. Each asks first, in the danger family, naming
 * the key, when it signs from and how many printouts it signed; Revoke takes its reason in the confirmation. A
 * refusal comes back in place of the row's actions.
 */
export function KeyTable({ columns, rows, acts, reopenRevoke, words, caption, sortNote, loading, locale }: Props) {
  const [retiring, setRetiring] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(reopenRevoke?.kid ?? null);
  const retireForm = useRef<HTMLFormElement>(null);
  const revokeForm = useRef<HTMLFormElement>(null);
  const factsOf = (kid: string | null) => rows.find((row) => row.kid === kid)?.facts ?? [];

  return (
    <>
      <Table
        columns={columns}
        rows={rows.map((row) => ({
          ...row.cells,
          _key: row.kid,
          ...(acts !== null
            ? {
                actions:
                  row.refusal !== null
                    ? { items: [], message: row.refusal.message, severity: "warning", code: row.refusal.code }
                    : [
                        ...(row.canRetire ? [{ label: words.retire, ariaLabel: `${words.retire} ${row.kid}`, variant: "quiet" as const, onClick: () => setRetiring(row.kid) }] : []),
                        ...(row.canRevoke ? [{ label: words.revoke, ariaLabel: `${words.revoke} ${row.kid}`, variant: "quiet" as const, onClick: () => setRevoking(row.kid) }] : []),
                      ],
              }
            : {}),
        }))}
        loading={loading}
        density="console"
        rowFocus
        sortNote={sortNote}
        caption={caption}
        locale={locale}
      />
      {acts !== null && (
        <>
          {/* display: contents keeps each form out of the layout; it only carries the dialog's fields to the action. */}
          <form ref={retireForm} action={acts.retire} noValidate style={{ display: "contents" }}>
            <input type="hidden" name="kid" value={retiring ?? ""} />
            <Dialog
              title={fill(words.retireTitle, retiring ?? "")}
              description={words.retireText}
              primaryAction={{ label: fill(words.retireYes, retiring ?? ""), variant: "danger", onClick: () => retireForm.current?.requestSubmit() }}
              secondaryAction={{ label: words.cancel, onClick: () => setRetiring(null) }}
              onClose={() => setRetiring(null)}
              open={retiring !== null}
              placement="overlay"
              align="start"
              density="console"
              width="var(--container-xl)"
              locale={locale}
            >
              <FactList items={[...factsOf(retiring)]} density="console" locale={locale} />
            </Dialog>
          </form>
          <form ref={revokeForm} action={acts.revoke} noValidate style={{ display: "contents" }}>
            <input type="hidden" name="kid" value={revoking ?? ""} />
            <Dialog
              title={fill(words.revokeTitle, revoking ?? "")}
              description={words.revokeText}
              primaryAction={{ label: fill(words.revokeYes, revoking ?? ""), variant: "danger", onClick: () => revokeForm.current?.requestSubmit() }}
              secondaryAction={{ label: words.cancel, onClick: () => setRevoking(null) }}
              onClose={() => setRevoking(null)}
              open={revoking !== null}
              placement="overlay"
              align="start"
              density="console"
              width="var(--container-xl)"
              locale={locale}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <FactList items={[...factsOf(revoking)]} density="console" locale={locale} />
                <TextField
                  label={words.reason}
                  helper={words.reasonHelp}
                  name="reason"
                  {...(reopenRevoke !== null && reopenRevoke.kid === revoking ? { error: reopenRevoke.error } : {})}
                  multiline
                  rows={3}
                  maxLength={2000}
                  required
                  width="100%"
                  density="console"
                  locale={locale}
                />
              </div>
            </Dialog>
          </form>
        </>
      )}
    </>
  );
}

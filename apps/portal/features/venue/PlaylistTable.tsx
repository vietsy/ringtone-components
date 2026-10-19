"use client";

import { useState, useTransition } from "react";
import { Dialog, Table, TextField, type StatusValue } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { archivePlaylist, setDefaultPlaylist } from "./actions";

export interface PlaylistTableRow {
  id: string;
  name: string;
  href: string;
  revision: string;
  status: StatusValue;
  isDefault: boolean;
  canSetDefault: boolean;
  canArchive: boolean;
  /** The refusal of the last act on this row, beside it. */
  refusal: { text: string; code: string } | null;
}

/**
 * SCR-VEN-06's list: open a playlist, set one as the default, archive one. Archiving cannot be undone, so it asks
 * first, naming the consequence, with an optional reason the service's audit log keeps (convention 10).
 */
export function PlaylistTable({
  service,
  rows,
  copy,
  phone,
  locale,
}: {
  service: string;
  rows: readonly PlaylistTableRow[];
  copy: {
    caption: string;
    name: string;
    revision: string;
    state: string;
    isDefault: string;
    defaultMark: string;
    setDefault: string;
    archive: string;
    dialogTitle: string;
    dialogText: string;
    reason: string;
    reasonHelp: string;
    confirm: string;
    keep: string;
  };
  phone: boolean;
  locale: Locale;
}) {
  const [archiving, setArchiving] = useState<PlaylistTableRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, startBusy] = useTransition();
  return (
    <>
      <Table
        columns={[
          { key: "name", label: copy.name, kind: "stack" },
          { key: "rev", label: copy.revision, nowrap: true },
          { key: "state", label: copy.state, kind: "status" },
          { key: "def", label: copy.isDefault, nowrap: true },
          { key: "act", kind: "actions" },
        ]}
        rows={rows.map((row) => {
          const items = [
            ...(row.canSetDefault
              ? [{ label: copy.setDefault, variant: "secondary" as const, ariaLabel: `${copy.setDefault} ${row.name}`, onClick: () => startBusy(() => setDefaultPlaylist(service, row.id)) }]
              : []),
            ...(row.canArchive ? [{ label: copy.archive, variant: "quiet" as const, icon: "archive", ariaLabel: `${copy.archive} ${row.name}`, onClick: () => setArchiving(row) }] : []),
          ];
          return {
            _key: row.id,
            name: { text: row.name, href: row.href },
            rev: row.revision,
            state: row.status,
            def: row.isDefault ? copy.defaultMark : "",
            act: row.refusal !== null ? { items, message: row.refusal.text, severity: "warning", code: row.refusal.code } : items.length > 0 ? items : null,
          };
        })}
        layout={phone ? "cards" : "table"}
        density="portal"
        caption={copy.caption}
        locale={locale}
      />
      {archiving !== null ? (
        <Dialog
          title={copy.dialogTitle.replace("{name}", archiving.name)}
          description={copy.dialogText}
          primaryAction={{
            label: copy.confirm,
            variant: "danger",
            loading: busy,
            onClick: () => {
              const form = new FormData();
              form.set("reason", reason);
              startBusy(() => archivePlaylist(service, archiving.id, form));
            },
          }}
          secondaryAction={{ label: copy.keep, onClick: () => setArchiving(null) }}
          onClose={() => setArchiving(null)}
          open
          placement="viewport"
          density="portal"
          locale={locale}
        >
          <TextField label={copy.reason} name="reason" helper={copy.reasonHelp} value={reason} onChange={setReason} multiline rows={2} density="portal" locale={locale} />
        </Dialog>
      ) : null}
    </>
  );
}

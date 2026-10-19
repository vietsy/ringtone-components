"use client";

import { useState, useTransition } from "react";
import { Dialog, Table, TextField, type StatusValue } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { withdrawSchedule } from "./actions";

export interface ScheduleTableRow {
  id: string;
  playlist: string;
  note: string | null;
  days: string;
  /** The days as they read inside a sentence ("thứ hai - thứ sáu"). */
  daysInSentence: string;
  time: string;
  from: string;
  saved: string;
  status: StatusValue;
  active: boolean;
  /** The refusal of the last withdrawal of this row (SCHEDULE_NOT_ACTIVE), beside it. */
  refusal: { text: string; code: string } | null;
}

/**
 * SCR-VEN-08's saved schedules and Withdraw. A saved schedule is never edited; withdrawing one asks first, naming the
 * schedule and what plays instead, with an optional reason the service's audit log keeps (convention 10).
 */
export function ScheduleTable({
  service,
  rows,
  copy,
  phone,
  locale,
}: {
  service: string;
  rows: readonly ScheduleTableRow[];
  copy: {
    caption: string;
    playlist: string;
    when: string;
    from: string;
    saved: string;
    state: string;
    withdraw: string;
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
  const [withdrawing, setWithdrawing] = useState<ScheduleTableRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, startBusy] = useTransition();
  return (
    <>
      <Table
        columns={[
          { key: "list", label: copy.playlist, kind: "stack" },
          { key: "when", label: copy.when, kind: "stack", nowrap: true },
          { key: "from", label: copy.from, kind: "date", nowrap: true },
          { key: "saved", label: copy.saved, kind: "stamp", nowrap: true },
          { key: "state", label: copy.state, kind: "status" },
          { key: "act", kind: "actions" },
        ]}
        rows={rows.map((row) => {
          const items = row.active
            ? [{ label: copy.withdraw, variant: "quiet" as const, ariaLabel: `${copy.withdraw} ${row.playlist} ${row.days} ${row.time}`, onClick: () => setWithdrawing(row) }]
            : [];
          return {
            _key: row.id,
            list: { text: row.playlist, ...(row.note !== null ? { detail: row.note } : {}) },
            when: { text: row.days, detail: row.time, plain: true, num: true },
            from: row.from,
            saved: row.saved,
            state: row.status,
            act: row.refusal !== null ? { items, message: row.refusal.text, severity: "warning", code: row.refusal.code } : items.length > 0 ? items : null,
          };
        })}
        layout={phone ? "cards" : "table"}
        density="portal"
        caption={copy.caption}
        locale={locale}
      />
      {withdrawing !== null ? (
        <Dialog
          title={copy.dialogTitle.replace("{playlist}", withdrawing.playlist).replace("{days}", withdrawing.daysInSentence).replace("{time}", withdrawing.time)}
          description={copy.dialogText}
          primaryAction={{
            label: copy.confirm,
            variant: "danger",
            loading: busy,
            onClick: () => {
              const form = new FormData();
              form.set("reason", reason);
              startBusy(() => withdrawSchedule(service, withdrawing.id, form));
            },
          }}
          secondaryAction={{ label: copy.keep, onClick: () => setWithdrawing(null) }}
          onClose={() => setWithdrawing(null)}
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

"use client";

import { useState } from "react";
import { SegmentedControl, Table, type StatusValue } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

export interface DayPeriods {
  date: string;
  /** The day's short name for the control ("T6", "Fri"). */
  short: string;
  /** The day's full name for the table's caption. */
  label: string;
  rows: readonly { key: string; time: string; playlist: string; note: string | null; outcome: StatusValue }[];
}

/**
 * SCR-VEN-08's period table, one day at a time: what plays in each period of the chosen day and why, with the
 * schedule that lost named on its row. On a phone it is the week, the grid being too narrow to read there.
 */
export function PeriodsByDay({
  days,
  initial,
  copy,
  phone,
  locale,
}: {
  days: readonly DayPeriods[];
  initial: string;
  copy: { periodsOf: string; time: string; playlist: string; outcome: string };
  phone: boolean;
  locale: Locale;
}) {
  const [chosen, setChosen] = useState(initial);
  const day = days.find((candidate) => candidate.date === chosen) ?? days[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <SegmentedControl
        label={copy.periodsOf}
        options={days.map((candidate) => ({ value: candidate.date, label: candidate.short }))}
        value={day?.date ?? ""}
        onChange={setChosen}
        density="portal"
        locale={locale}
      />
      {day !== undefined ? (
        <Table
          columns={[
            { key: "time", label: copy.time, nowrap: true, num: true },
            { key: "list", label: copy.playlist, kind: "stack" },
            { key: "outcome", label: copy.outcome, kind: "status" },
          ]}
          rows={day.rows.map((row) => ({
            _key: row.key,
            time: row.time,
            list: { text: row.playlist, ...(row.note !== null ? { detail: row.note } : {}) },
            outcome: row.outcome,
          }))}
          layout={phone ? "cards" : "table"}
          density="portal"
          caption={`${copy.periodsOf}, ${day.label}`}
          locale={locale}
        />
      ) : null}
    </div>
  );
}

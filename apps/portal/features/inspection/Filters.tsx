"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ComponentProps } from "react";
import { Button, Combobox, FilterBar, Select, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

type Options = ComponentProps<typeof Select>["options"];

/**
 * SCR-VER-13 Premises: the premises the person acts for. Choosing one is the act: its records open, as the
 * board draws the choice with no button.
 */
export function PremisesChoice({ label, options, value, locale }: { label: string; options: Options; value: string; locale: Locale }) {
  const router = useRouter();
  return (
    <Combobox
      label={label}
      name="premises"
      options={options}
      value={value}
      wrap
      required
      onChange={(chosen) => {
        if (typeof chosen === "string" && chosen !== value) router.push(routes.inspectionRecords(chosen));
      }}
      density="portal"
      locale={locale}
    />
  );
}

/**
 * SCR-VER-18's filter and its record reference: choosing a flag reads the list again at once; Open reads the
 * record typed, and waits until a reference is typed (design/03 SCR-VER-18).
 */
export function WorkFilter({
  flags,
  flag,
  record,
  words,
  chip,
  summary,
  locale,
}: {
  flags: Options;
  /** The flag the list was read with; "" for every flag. */
  flag: string;
  record: string;
  words: { filters: string; flagLabel: string; recordRef: string; open: string; openWhy: string };
  /** The chip of a flag other than every flag, and the way to clear it. */
  chip: string | null;
  summary: string | null;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [typed, setTyped] = useState(record);
  return (
    // A GET form: the flag and the reference are the page's address, so a reload or the back button keeps them.
    <form ref={form} action={routes.inspectionWork()} method="get" style={{ display: "contents" }}>
      <FilterBar
        label={words.filters}
        shortcut="/"
        {...(chip !== null ? { chips: [{ label: chip, onRemove: () => router.push(routes.inspectionWork()) }], active: true } : {})}
        {...(summary !== null ? { summary } : {})}
        locale={locale}
      >
        <Select
          label={words.flagLabel}
          name="flag"
          options={flags}
          value={flag}
          onChange={() => setTimeout(() => form.current?.requestSubmit(), 0)}
          density="console"
          width="var(--space-72)"
          locale={locale}
        />
        <TextField
          label={words.recordRef}
          name="record"
          mono
          value={typed}
          onChange={setTyped}
          placeholder="IRC-"
          density="console"
          width="var(--space-56)"
          locale={locale}
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          icon="file-check"
          {...(typed.trim() === "" ? { disabled: true, disabledReason: words.openWhy } : {})}
          locale={locale}
        >
          {words.open}
        </Button>
      </FilterBar>
    </form>
  );
}

/** SCR-VER-16's period and authority: choosing either reads the month again. */
export function OversightFilter({
  periods,
  period,
  authorities,
  authority,
  words,
  summary,
  locale,
}: {
  periods: Options;
  period: string;
  authorities: Options;
  /** "" for every authority. */
  authority: string;
  words: { filters: string; period: string; authority: string };
  summary: string | null;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const send = () => setTimeout(() => form.current?.requestSubmit(), 0);
  return (
    <form ref={form} action={routes.oversightInspections()} method="get" style={{ display: "contents" }}>
      <FilterBar label={words.filters} shortcut="/" {...(summary !== null ? { summary } : {})} locale={locale}>
        <Select label={words.period} name="period" options={periods} value={period} required onChange={send} density="console" width="var(--space-48)" locale={locale} />
        <Select label={words.authority} name="authority" options={authorities} value={authority} onChange={send} density="console" width="var(--space-80)" locale={locale} />
      </FilterBar>
    </form>
  );
}

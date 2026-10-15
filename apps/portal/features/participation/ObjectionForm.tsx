"use client";

import { useState } from "react";
import { Button, ButtonRow, ChoiceList, Dialog, Divider, Panel, TextField } from "@/components/r1";
import type { ObjectionKind } from "@/lib/api/participation";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { day, fieldMissing, partTranslator } from "./copy";
import { oneOf, text } from "./fields";
import { sameReading, useFormReading } from "./useFormReading";

const KINDS: readonly ObjectionKind[] = ["objection", "correction", "erasure"];

interface Reading {
  requested: ObjectionKind | null;
  ground: string;
}

/**
 * SCR-CAT-25's request: the kind asked for, the ground, and Lodge. Lodge waits for both, saying why beside it;
 * pressed, it opens the confirmation the specification requires, which states the date an answer is due for
 * the kind chosen and that the decision stays in force meanwhile. Confirmed, the form is sent.
 *
 * The confirmation the person opens covers the window. The one the canvas draws open on arrival (the confirm
 * view) stays in the page, as the board places it: a dialog portalled to the window exists only in the browser.
 */
export function ObjectionForm({
  action,
  decision,
  dueBy,
  initial,
  flagged,
  openOnArrival,
  phone,
  locale,
}: {
  action: (formData: FormData) => Promise<void>;
  /** The reference the decision was notified under. */
  decision: string;
  /** The ISO date an answer would be due, for each kind. */
  dueBy: Readonly<Record<ObjectionKind, string>>;
  initial: Reading;
  /** Fields a refused lodging named as missing (`request_kind`, `ground`), shown until they are filled. */
  flagged: readonly string[];
  openOnArrival: boolean;
  phone: boolean;
  locale: Locale;
}) {
  const t = partTranslator(locale);
  const [form, reading] = useFormReading<Reading>(
    (data) => ({ requested: oneOf(text(data, "request_kind"), KINDS), ground: text(data, "ground") }),
    initial,
    sameReading,
  );
  const [open, setOpen] = useState<"on-arrival" | "by-person" | null>(openOnArrival ? "on-arrival" : null);
  const [sending, setSending] = useState(false);
  const ready = reading.requested !== null && reading.ground !== "";
  const kind = reading.requested ?? "objection";
  const errorAt = (field: "request_kind" | "ground", empty: boolean, label: string) => (flagged.includes(field) && empty ? { error: fieldMissing(label, t) } : {});

  return (
    <form ref={form} action={action} noValidate>
      <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Panel variant="plain" level={2} title={t("part25.askTitle")} density="portal" locale={locale}>
          <ChoiceList
            legend={t("part25.askLegend")}
            options={KINDS.map((value) => ({ value, label: t(`part25.kind.${value}`) }))}
            {...(initial.requested !== null ? { value: initial.requested } : {})}
            required
            name="request_kind"
            {...errorAt("request_kind", reading.requested === null, t("part25.askLegend"))}
            density="portal"
            locale={locale}
          />
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("part25.groundTitle")} density="portal" locale={locale}>
          <TextField
            label={t("part25.ground")}
            helper={t("part25.groundHelp")}
            value={initial.ground}
            multiline
            rows={6}
            required
            maxLength={4000}
            name="ground"
            {...errorAt("ground", reading.ground === "", t("part25.ground"))}
            locale={locale}
          />
        </Panel>
        <ButtonRow>
          <Button
            variant="primary"
            size="md"
            fullWidth={phone}
            disabled={!ready}
            {...(!ready ? { disabledReason: t("part25.chooseFirst") } : {})}
            onClick={() => setOpen("by-person")}
            locale={locale}
          >
            {t("part25.lodge")}
          </Button>
          <Button variant="quiet" size="md" fullWidth={phone} href={routes.orgParticipation()} locale={locale}>
            {t("part25.cancel")}
          </Button>
        </ButtonRow>
      </Panel>
      {open !== null ? (
        <Dialog
          title={t(`part25.dlgTitle.${kind}`, { reference: decision })}
          description={t("part25.dlgText", { date: day(dueBy[kind], locale) })}
          primaryAction={{
            label: t(`part25.dlgYes.${kind}`),
            loading: sending,
            onClick: () => {
              setSending(true);
              form.current?.requestSubmit();
            },
          }}
          secondaryAction={{ label: t("part25.dlgNo"), onClick: () => setOpen(null) }}
          onClose={() => setOpen(null)}
          open
          placement={open === "on-arrival" ? "overlay" : "viewport"}
          // The page is taller than a window, so the dialog drawn over it sits near its top, where it is read.
          align="start"
          autoFocus={open !== "on-arrival"}
          density="portal"
          width={phone ? "100%" : "var(--container-xl)"}
          locale={locale}
        />
      ) : null}
    </form>
  );
}

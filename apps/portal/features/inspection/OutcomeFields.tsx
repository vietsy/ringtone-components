"use client";

import { useState, type ComponentProps } from "react";
import { Banner, ChoiceList, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Options = ComponentProps<typeof ChoiceList>["options"];

interface Props {
  /** The outcome chosen; the empty string while none is. */
  outcome: { legend: string; options: Options; value: string };
  /** The refusal the outcome got when it was last sent. */
  refusal: { code: string; title: string; text: string } | null;
  guidance: { label: string; value: string; error: string | null };
  referral: { legend: string; options: Options; value: string; noteLabel: string; noteValue: string; noteError: string | null };
  /** The field client's (portal) or the inspection console's (SCR-VER-15). */
  density?: "portal" | "console";
  layout?: "list" | "inline";
  locale: Locale;
}

/**
 * SCR-VER-05's outcome and what it asks for next: "Đã hướng dẫn" asks for the guidance given, "Chuyển theo dõi
 * tiếp" for the route and its note. Choosing another outcome changes the fields under it at once, as on the board.
 */
export function OutcomeFields({ outcome, refusal, guidance, referral, density = "portal", layout = "list", locale }: Props) {
  const [chosen, setChosen] = useState(outcome.value);

  return (
    <>
      <ChoiceList
        legend={outcome.legend}
        name="outcome"
        options={outcome.options}
        value={chosen}
        required
        layout={layout}
        onChange={(event) => {
          const target = (event as { target?: { value?: unknown } }).target;
          if (typeof target?.value === "string") setChosen(target.value);
        }}
        density={density}
        locale={locale}
      />
      {refusal !== null && (
        <Banner family="attention" title={refusal.title} code={refusal.code} density={density} locale={locale}>
          {refusal.text}
        </Banner>
      )}
      {chosen === "GUIDANCE_GIVEN" && (
        <TextField
          label={guidance.label}
          name="guidance_text"
          value={guidance.value}
          {...(guidance.error !== null ? { error: guidance.error } : {})}
          multiline
          rows={4}
          required
          maxLength={4000}
          density={density}
          locale={locale}
        />
      )}
      {chosen === "REFERRED" && (
        <>
          <ChoiceList
            legend={referral.legend}
            name="referral_route"
            options={referral.options}
            value={referral.value}
            required
            density={density}
            locale={locale}
          />
          <TextField
            label={referral.noteLabel}
            name="referral_note"
            value={referral.noteValue}
            {...(referral.noteError !== null ? { error: referral.noteError } : {})}
            multiline
            rows={3}
            required
            maxLength={4000}
            density={density}
            locale={locale}
          />
        </>
      )}
    </>
  );
}

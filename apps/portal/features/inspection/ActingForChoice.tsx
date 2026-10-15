"use client";

import { useRef, type ComponentProps } from "react";
import { ChoiceList } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { chooseActingFor } from "./actions";

type Options = ComponentProps<typeof ChoiceList>["options"];

interface Props {
  legend: string;
  options: Options;
  value: string | null;
  locale: Locale;
}

/**
 * SCR-VER-17 Acting for. The board draws the choice with no button: choosing an authority is the act, and the
 * phone keeps it to send with every act that names no inspection (design/03 SCR-VER-17, Acting for).
 */
export function ActingForChoice({ legend, options, value, locale }: Props) {
  const form = useRef<HTMLFormElement>(null);
  return (
    // display: contents keeps the choice in its panel's rhythm; the form only carries it to the action.
    <form ref={form} action={chooseActingFor} style={{ display: "contents" }}>
      <ChoiceList
        legend={legend}
        name="appointment_id"
        options={options}
        {...(value !== null ? { value } : {})}
        required
        // The radio is checked once the change has run; the form is sent after it.
        onChange={() => setTimeout(() => form.current?.requestSubmit(), 0)}
        density="portal"
        locale={locale}
      />
    </form>
  );
}

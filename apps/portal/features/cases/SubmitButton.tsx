"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/r1";

type Props = Omit<ComponentProps<typeof Button>, "type" | "loading" | "href" | "onClick"> & {
  /** Where one form carries two acts: the value its `intent` field takes when this button sends it. */
  intent?: string;
};

/** R1's Button as the submit of the form around it, working while that form's server action runs. */
export function SubmitButton({ intent, ...props }: Props) {
  const status = useFormStatus();
  const mark = (event: unknown) => {
    if (intent === undefined) return;
    const button = (event as { currentTarget?: unknown }).currentTarget;
    const field = button instanceof HTMLButtonElement ? button.form?.elements.namedItem("intent") : null;
    if (field instanceof HTMLInputElement) field.value = intent;
  };
  return <Button {...props} type="submit" loading={status.pending} onClick={mark} />;
}

"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/r1";

type Props = Omit<ComponentProps<typeof Button>, "type" | "loading" | "href" | "onClick"> & {
  /** Draws the button working without a submission in flight: the canvas's "starting" and "sending" views. */
  pending?: boolean;
};

/** R1's Button as the submit of the form around it, working while that form's server action runs. */
export function SubmitButton({ pending = false, ...props }: Props) {
  const status = useFormStatus();
  return <Button {...props} type="submit" loading={pending || status.pending} />;
}

"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/r1";

type Props = Omit<ComponentProps<typeof Button>, "type" | "loading" | "href" | "onClick">;

/** R1's Button as the submit of the console form around it, working while that form's server action runs. */
export function ActButton(props: Props) {
  const status = useFormStatus();
  return <Button {...props} type="submit" loading={status.pending} />;
}

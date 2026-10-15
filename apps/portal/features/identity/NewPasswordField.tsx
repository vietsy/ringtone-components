"use client";

import { useState, type ComponentProps } from "react";
import { PasswordField } from "@/components/r1";
import { passwordRules, type PasswordRuleTexts } from "./password-rules";

type Props = Omit<ComponentProps<typeof PasswordField>, "value" | "onChange" | "rules"> & {
  /** The value the page draws the field with. */
  initial: string;
  ruleTexts: PasswordRuleTexts;
};

/**
 * R1's PasswordField with its rule checklist following what is typed. A server page can hand the rules
 * only as they stand for the value it drew; the reader needs them to change as they type.
 */
export function NewPasswordField({ initial, ruleTexts, ...field }: Props) {
  const [value, setValue] = useState(initial);
  return <PasswordField {...field} value={value} onChange={setValue} rules={passwordRules(value, ruleTexts)} />;
}

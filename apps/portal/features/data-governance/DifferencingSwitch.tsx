"use client";

import { useState } from "react";
import { Switch } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * "Kiểm tra suy luận hiệu số theo cả kỳ" on SCR-DAT-16: R1's Switch, which sends nothing with a form, kept in step
 * with a hidden field the draft's form sends as `on` or `off`.
 */
export function DifferencingSwitch({ name, label, helper, checked, locale }: { name: string; label: string; helper: string; checked: boolean; locale: Locale }) {
  const [on, setOn] = useState(checked);
  return (
    <>
      <Switch label={label} helper={helper} checked={on} onChange={setOn} density="console" locale={locale} />
      <input type="hidden" name={name} value={on ? "on" : "off"} />
    </>
  );
}

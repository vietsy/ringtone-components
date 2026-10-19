"use client";

import type * as React from "react";
import { useEffect } from "react";
import { Checkbox } from "./Checkbox";
import { StatusIcon } from "./StatusIcon";
import { announce, cx, readerActed, textOf } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type FieldMessageProps = {
  severity?: "error" | "warning" | "info" | undefined;
  acknowledgeable?: boolean | undefined;
  acknowledged?: boolean | undefined;
  onAcknowledge?: ((e?: unknown) => void) | undefined;
  name?: string | undefined;
  id?: string | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
};

// An error is an alert. A warning that appears after the reader did something is said once through the page's
// live region; one drawn with the page is read in order. Its acknowledgement is the R1 Checkbox.
export function FieldMessage(p: FieldMessageProps) {
  const sev = p.severity || "error";
  const family = sev === "error" ? "danger" : sev === "warning" ? "attention" : "info";
  const t = tx(p.locale);
  const said = textOf(p.children);
  useEffect(
    function () {
      if (sev === "warning" && said && readerActed()) announce(said, "polite");
    },
    [sev, said],
  );
  return (
    <div
      id={p.id}
      className={cx("r1-msg", "r1-msg--" + family, p.className)}
      role={sev === "error" ? "alert" : undefined}
    >
      <StatusIcon family={family} size={16} cutout="surface" />
      <div className="r1-msg__body">
        <span>{p.children}</span>
        {sev === "warning" && p.acknowledgeable ? (
          <Checkbox
            className="r1-ack"
            label={t.ack}
            checked={!!p.acknowledged}
            name={p.name}
            onChange={p.onAcknowledge}
            locale={p.locale}
          />
        ) : null}
      </div>
    </div>
  );
}

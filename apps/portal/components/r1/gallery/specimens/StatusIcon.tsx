"use client";

import { StatusIcon } from "../..";
import type { Family } from "../../lib/types";
import type { Specimen } from "../specimen";

export const StatusIconSpecimen: Specimen = {
  name: "StatusIcon",
  group: "Status",
  height: 80,
  render() {
    return (
      <div className="pv">
        {(["positive", "attention", "danger", "neutral", "info"] satisfies Family[])
          .map(function (f) {
            return (
              <span
                key={f}
                style={{
                  color: "var(--" + f + "-text)",
                  display: "inline-flex",
                  gap: "var(--space-2)",
                  alignItems: "center",
                  fontSize: "var(--text-sm)",
                }}
              >
                <StatusIcon family={f} size={24} />
                {f}
              </span>
            );
          })
          .concat([
            <span
              key="s"
              style={{
                color: "var(--accent)",
                display: "inline-flex",
                gap: "var(--space-2)",
                alignItems: "center",
                fontSize: "var(--text-sm)",
              }}
            >
              <StatusIcon family="seal" size={24} />
              seal
            </span>,
          ])}
      </div>
    );
  },
};

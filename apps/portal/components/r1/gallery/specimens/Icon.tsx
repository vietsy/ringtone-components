"use client";

import { Icon } from "../..";
import type { Specimen } from "../specimen";

export const IconSpecimen: Specimen = {
  name: "Icon",
  group: "Icons",
  height: 150,
  render() {
    return (
      <div className="pv" style={{ color: "var(--on-surface-secondary)" }}>
        {[
          "wifi",
          "wifi-off",
          "play",
          "hard-drive",
          "shield-check",
          "file-check",
          "archive",
          "inbox",
          "scale",
          "database",
          "arrow-right-left",
          "power",
          "qr-code",
          "clock",
          "history",
          "route",
          "users",
          "building-2",
          "search",
          "copy",
          "banknote",
          "credit-card",
          "approximately-equal",
          "circle-dashed",
          "image",
        ].map(function (n) {
          return (
            <span
              key={n}
              title={n}
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--space-1)",
                width: "calc(var(--spacing) * 18)",
                fontSize: "var(--text-xs)",
                lineHeight: "var(--leading-xs)",
              }}
            >
              <Icon name={n} size={24} />
              {n}
            </span>
          );
        })}
      </div>
    );
  },
};

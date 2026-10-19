"use client";

import type * as React from "react";
import { cx } from "./lib/helpers";
import { SEAL_POINTS, STATUS_FAMILIES } from "./lib/icons";
import type { Family } from "./lib/types";

export type StatusIconProps = {
  family: Family | "seal";
  size?: number | undefined;
  cutout?: string | undefined;
  className?: string | undefined;
};

export function StatusIcon(p: StatusIconProps) {
  const size = p.size || 16;
  const cut: React.CSSProperties = {
    stroke: "var(--" + (p.cutout || "surface") + ")",
    strokeWidth: 2.5,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const cutFill = { fill: "var(--" + (p.cutout || "surface") + ")" };
  const solid = { fill: "currentColor" };
  let kids;
  switch (p.family === "seal" || STATUS_FAMILIES.indexOf(p.family) >= 0 ? p.family : "neutral") {
    case "positive":
      kids = [
        <circle key={1} cx={12} cy={12} r={10} style={solid} />,
        <path key={2} d="m7.5 12.5 3 3 6-6.5" style={cut} />,
      ];
      break;
    case "attention":
      kids = [
        <path
          key={1}
          d="M12 2.8 22.4 20.6H1.6Z"
          style={{ fill: "currentColor", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" }}
        />,
        <path key={2} d="M12 9.2v4.8" style={cut} />,
        <circle key={3} cx={12} cy={17.2} r={1.35} style={cutFill} />,
      ];
      break;
    case "danger":
      kids = [
        <path key={1} d="M8.1 2h7.8L22 8.1v7.8L15.9 22H8.1L2 15.9V8.1Z" style={solid} />,
        <path key={2} d="m9 9 6 6m0-6-6 6" style={cut} />,
      ];
      break;
    case "neutral":
      kids = [
        <circle key={1} cx={12} cy={12} r={8.75} style={{ fill: "none", stroke: "currentColor", strokeWidth: 2.5 }} />,
      ];
      break;
    case "info":
      kids = [
        <circle key={1} cx={12} cy={12} r={10} style={solid} />,
        <path key={2} d="M12 11v6" style={cut} />,
        <circle key={3} cx={12} cy={7.4} r={1.35} style={cutFill} />,
      ];
      break;
    case "seal":
      kids = [
        <polygon key={1} points={SEAL_POINTS} style={solid} />,
        <path key={2} d="m7.8 12.3 2.9 2.9 5.5-6" style={cut} />,
      ];
      break;
    default:
      return null;
  }
  return (
    <svg
      className={cx("r1-status-icon", p.className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {kids}
    </svg>
  );
}

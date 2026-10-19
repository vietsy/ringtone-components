"use client";

import { ProvenanceChip, format } from "../..";
import type { Provenance } from "../../lib/types";
import type { Specimen } from "../specimen";

export const ProvenanceChipSpecimen: Specimen = {
  name: "ProvenanceChip",
  group: "Values",
  height: 230,
  render() {
    const dat: Provenance[] = ["authoritative", "declared", "derived", "estimated", "imputed", "illustrative"];
    return (
      <div className="pv">
        <div className="pv__row">
          {(["registry-sourced", "declared", "evidenced", "corrected", "derived"] satisfies Provenance[]).map(function (k) {
            return (
              <ProvenanceChip
                key={k}
                kind={k}
                detail={k === "registry-sourced" ? "Cổng ĐKKD, " + format.date("2026-09-17") : undefined}
              />
            );
          })}
        </div>
        <div className="pv__row">
          {dat.map(function (k) {
            return (
              <ProvenanceChip
                key={k}
                kind={k}
                detail={k === "estimated" ? "Theo diện tích khai, " + format.date("2026-10-01") : undefined}
              />
            );
          })}
        </div>
        <div className="pv__row">
          {dat.map(function (k) {
            return <ProvenanceChip key={k} kind={k} words="plain" />;
          })}
        </div>
      </div>
    );
  },
};

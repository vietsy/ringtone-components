"use client";

import { Skeleton } from "../..";
import type { Specimen } from "../specimen";

export const SkeletonSpecimen: Specimen = {
  name: "Skeleton",
  group: "Feedback",
  height: 392,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "var(--space-8)",
          alignItems: "start",
        }}
      >
        <Skeleton rows={3} density="console" />
        <Skeleton variant="facts" rows={3} />
        <Skeleton variant="card" rows={2} />
        <Skeleton variant="chart" columns={6} />
      </div>
    );
  },
};

"use client";

import { DocumentPreview } from "../..";
import type { Specimen } from "../specimen";

export const DocumentPreviewSpecimen: Specimen = {
  name: "DocumentPreview",
  group: "Data",
  height: 744,
  render() {
    return (
      <div
        className="pv"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start" }}
      >
        <DocumentPreview
          title="giay-phep-kinh-doanh-then-cua-pasteur.pdf"
          type="pdf"
          page={1}
          pages={2}
          href="/files/giay-phep-kinh-doanh-then-cua-pasteur.pdf"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ height: "var(--space-3)", width: "60%", background: "var(--neutral-tint)" }} />
            {[92, 88, 95, 70, 90, 84, 60].map(function (w, i) {
              return (
                <div key={i} style={{ height: "var(--space-2)", width: w + "%", background: "var(--neutral-tint)" }} />
              );
            })}
            <div style={{ height: "var(--space-6)" }} />
            {[90, 94, 80, 86, 40].map(function (w, i) {
              return (
                <div
                  key={"b" + i}
                  style={{ height: "var(--space-2)", width: w + "%", background: "var(--neutral-tint)" }}
                />
              );
            })}
          </div>
        </DocumentPreview>
        <DocumentPreview
          title="hop-dong-thue-mat-bang.pdf"
          type="pdf"
          page={2}
          pages={5}
          loading={true}
          href="/files/hop-dong-thue-mat-bang.pdf"
        />
      </div>
    );
  },
};

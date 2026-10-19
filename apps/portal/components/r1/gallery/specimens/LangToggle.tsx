"use client";

import { LangToggle } from "../..";
import type { Specimen } from "../specimen";

export const LangToggleSpecimen: Specimen = {
  name: "LangToggle",
  group: "Shells",
  height: 80,
  render() {
    return (
      <div className="pv">
        <LangToggle locale="vi" />
        <LangToggle locale="en" />
        <LangToggle locale="vi" density="console" />
      </div>
    );
  },
};

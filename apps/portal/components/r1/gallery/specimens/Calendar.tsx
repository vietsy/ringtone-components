"use client";

import { Calendar } from "../..";
import type { Specimen } from "../specimen";

export const CalendarSpecimen: Specimen = {
  name: "Calendar",
  group: "Forms",
  height: 340,
  render() {
    return (
      <div className="pv" style={{ flexDirection: "row", gap: "var(--space-6)", alignItems: "flex-start" }}>
        <Calendar value="2026-10-03" today="2026-09-29" min="2026-09-29" />
        <Calendar value="2026-09-01" to="2026-09-14" today="2026-09-29" />
      </div>
    );
  },
};

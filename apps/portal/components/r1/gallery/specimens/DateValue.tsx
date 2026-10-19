"use client";

import { DateValue } from "../..";
import type { Specimen } from "../specimen";

export const DateValueSpecimen: Specimen = {
  name: "DateValue",
  group: "Values",
  height: 120,
  render() {
    return (
      <div className="pv">
        <DateValue value="2026-09-17" />
        <DateValue value="2026-09-17" form="legal" />
        <DateValue value="2026-09-17T08:15:00+07:00" mode="timestamp" />
        <DateValue value="2026-09-01" to="2026-09-30" mode="period" />
        <DateValue value="2026-09-17T18:30:00+07:00" mode="time" />
        <DateValue value={null} />
        <DateValue value="2026-09-10T14:00:00+07:00" mode="timestamp" locale="en" />
        {/* Figma's Size: md and sm, set on the value instead of taken from its container. */}
        <DateValue value="2026-09-17" size="md" />
        <DateValue value="2026-09-17T08:15:00+07:00" mode="timestamp" size="md" />
        <DateValue value={null} size="md" />
        <DateValue value="2026-09-17" size="sm" />
        <DateValue value="2026-09-17T08:15:00+07:00" mode="timestamp" size="sm" />
        <DateValue value={null} size="sm" />
      </div>
    );
  },
};

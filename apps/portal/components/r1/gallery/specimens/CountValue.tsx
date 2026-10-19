"use client";

import { CountValue } from "../..";
import type { Specimen } from "../specimen";

export const CountValueSpecimen: Specimen = {
  name: "CountValue",
  group: "Values",
  height: 80,
  render() {
    return (
      <div className="pv">
        <CountValue value={4120} />
        <CountValue value={0} />
        <CountValue value={null} />
        <CountValue value={46} unit="thiết bị" />
        <CountValue value={1} unit={{ one: "field", other: "fields" }} locale="en" />
        <CountValue value={1412908} unit={{ one: "field", other: "fields" }} locale="en" />
        {/* Figma's Size: md and sm, set on the value instead of taken from its container. */}
        <CountValue value={46} unit="thiết bị" size="md" />
        <CountValue value={null} size="md" />
        <CountValue value={46} unit="thiết bị" size="sm" />
        <CountValue value={null} size="sm" />
      </div>
    );
  },
};

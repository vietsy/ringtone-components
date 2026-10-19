"use client";

import { MoneyValue } from "../..";
import type { Specimen } from "../specimen";

export const MoneyValueSpecimen: Specimen = {
  name: "MoneyValue",
  group: "Values",
  height: 120,
  render() {
    return (
      <div className="pv">
        <MoneyValue amountMinor={1250000} />
        <MoneyValue amountMinor={1847500000} />
        <MoneyValue amountMinor={0} />
        <MoneyValue amountMinor={-160380} />
        <MoneyValue amountMinor={null} />
        <MoneyValue amountMinor={null} missing="Chưa tính phí" />
        <MoneyValue amountMinor={1250000} locale="en" />
        {/* Figma's Size: md and sm, set on the value instead of taken from its container. */}
        <MoneyValue amountMinor={1250000} size="md" />
        <MoneyValue amountMinor={-160380} size="md" />
        <MoneyValue amountMinor={null} size="md" />
        <MoneyValue amountMinor={1250000} size="sm" />
        <MoneyValue amountMinor={-160380} size="sm" />
        <MoneyValue amountMinor={null} size="sm" />
      </div>
    );
  },
};

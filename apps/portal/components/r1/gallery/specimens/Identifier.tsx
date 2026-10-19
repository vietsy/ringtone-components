"use client";

import { Identifier } from "../..";
import type { Specimen } from "../specimen";

export const IdentifierSpecimen: Specimen = {
  name: "Identifier",
  group: "Values",
  height: 120,
  render() {
    return (
      <div className="pv">
        <Identifier value="R1-CER-2026-J7K2M4QP" />
        <Identifier value="PLY-0031" size="sm" />
        <Identifier value="SUP-8KD4QW7TXN" size="lg" />
        <Identifier value={null} missing="Chưa cấp" />
        <Identifier value="DSP-0104" locale="en" />
      </div>
    );
  },
};

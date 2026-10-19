"use client";

import { SignatureBlock } from "../..";
import type { Specimen } from "../specimen";

export const SignatureBlockSpecimen: Specimen = {
  name: "SignatureBlock",
  group: "Legal",
  height: 480,
  render() {
    return (
      <div
        className="pv"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          alignItems: "start",
          gap: "var(--space-8)",
        }}
      >
        <SignatureBlock
          legalName="Nguyễn Duy Lâm"
          typedName="Nguyen Duy Lam"
          scrolledToEnd={false}
          signLabel="Ký giấy phép"
        />
        <SignatureBlock
          legalName="Nguyễn Duy Lâm"
          typedName="Nguyễn Duy Lâm"
          scrolledToEnd={true}
          signLabel="Ký giấy phép"
        />
        <SignatureBlock
          legalName="Nguyễn Duy Lâm"
          typedName="Nguyễn Duy Lâm"
          scrolledToEnd={true}
          loading={true}
          signLabel="Ký giấy phép"
        />
        <SignatureBlock
          legalName="Nguyễn Duy Lâm"
          typedName="Nguyễn Duy Lâm"
          scrolledToEnd={true}
          signed={true}
          signedAt="2026-09-30T10:42:00+07:00"
          signLabel="Ký giấy phép"
        />
      </div>
    );
  },
};

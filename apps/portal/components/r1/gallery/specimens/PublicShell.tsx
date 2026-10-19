"use client";

import { PublicShell, ScanView, VerificationResult } from "../..";
import type { Specimen } from "../specimen";

export const PublicShellSpecimen: Specimen = {
  name: "PublicShell",
  group: "Shells",
  height: 1060,
  render() {
    return (
      <div className="pv">
        <div style={{ height: "var(--space-80)", flex: "1 1 100%" }}>
          <PublicShell>
            <h1 className="r1-page-title">Chính sách đảm bảo thiết bị</h1>
            <p>Mọi nhà cung cấp đều có thể xin chứng nhận theo cùng một bộ tiêu chí công khai.</p>
          </PublicShell>
        </div>
        <div className="pv__phone">
          <PublicShell variant="field" network="online" verificationKey={{ state: "valid", until: "2026-10-31" }}>
            <ScanView state="scanning" recordNoun="giấy xác nhận" />
          </PublicShell>
        </div>
        <div className="pv__phone">
          <PublicShell
            variant="field"
            network="offline"
            verificationKey={{ state: "expiring", until: "2026-10-07T18:00:00+07:00" }}
          >
            <VerificationResult
              result="valid"
              recordNoun="giấy xác nhận"
              recordId="R1-CER-2026-T7QM4BWJ"
              checkedAt="2026-10-07T10:40:00+07:00"
              checkedLabel="Kiểm tra trên máy lúc"
            />
          </PublicShell>
        </div>
        <div className="pv__phone">
          <PublicShell variant="field" network="offline" verificationKey={{ state: "missing" }}>
            <ScanView
              state="unavailable"
              recordNoun="giấy xác nhận"
              reason="Máy chưa có khoá xác minh nên chưa kiểm tra được mã. Kết nối mạng để tải khoá."
            />
          </PublicShell>
        </div>
      </div>
    );
  },
};

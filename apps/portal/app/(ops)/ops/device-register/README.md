# device-register

    page.tsx                 SCR-IAM-07  device register: every credential a device holds, active, suspended, revoked
    [credential]/page.tsx    SCR-IAM-08  one credential: suspend, reinstate, revoke

IAM's device credentials on the operations console, under the rail entry "Sổ thiết bị" the IAM frames draw. The
operations officer (ACT-OPS) acts; the security officer (ACT-SEC) reads, and the acts say why they are unavailable.
A credential is addressed by its reference (DCR-...). `?view=empty`, `loading`, `error`, `not-found` draw the states
no act reaches.

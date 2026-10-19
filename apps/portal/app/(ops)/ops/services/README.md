# services

    page.tsx                         SCR-VEN-12  the entitlement register, the Player services workspace's landing
    [service]/page.tsx               SCR-VEN-13  one service's case file
    [service]/enforcement/page.tsx   SCR-VEN-14  suspend, restrict or revoke it
    [service]/reinstatement/page.tsx SCR-VEN-15  reinstate it
    [service]/scope-exit/page.tsx    SCR-VEN-16  record that its premises left the scope

The VEN family on the operations console. Every page reads the browser's world from `lib/mock/backend/venue.ts`; the
acts are `features/venue/console-actions.ts`. Operations (ACT-OPS) read the register and act; evidence (ACT-EVD) and
legal (ACT-LGL) reach one service by its code, to its case file and to a scope exit respectively.

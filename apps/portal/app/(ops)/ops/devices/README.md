# devices

    page.tsx             SCR-PLR-01  device estate, the Player devices workspace's landing
    [device]/page.tsx    SCR-PLR-02  one device's record and Record a condition
    enrol/page.tsx       SCR-PLR-03  enrol a device

PLR's devices on the operations console, for the operations officer (ACT-OPS: Phan Gia Lượng, Quan Ngọc Trâm). A
device is addressed by its reference (PLY-0023). Every page reads the browser's world from
`lib/mock/backend/player.ts`; the acts are `features/player-ops/actions.ts`. `?view=empty`, `loading`, `error`
(and `not-found` on a record) draw the states no act reaches.

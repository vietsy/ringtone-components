# backend

The mock backend: what the API will hold and do, played in the server process while the portal runs on
mock data. Commands change state and later reads see the change, so the portal is walked as it will be
used: sign in, act, and the next screen shows what the act did.

    store.ts       the memory: accounts and sessions process-wide, each family's tables per session
    accounts.ts    RightOne ID's accounts and organisations, from the canvas's data sheet
    identity.ts    RightOne ID's answers: sign-in, organisation choice, registration, confirmation
    ids.ts         new references in the canvas's form (REG-P5TJ4BXC7M, R1-CER-2026-T7QM4BWJ)
    clock.ts       the moment an act happens, and calendar arithmetic in Vietnam time
    <family>.ts    one per family: its state, seeded from the canvas data in `lib/mock/<family>.ts`, and
                   one function per command the API will offer, refusing with the spec's refusal codes

Every sign-in starts from the seed, and a server restart forgets everything. Nothing here is a real record.

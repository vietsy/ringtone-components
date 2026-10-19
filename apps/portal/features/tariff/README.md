# tariff

What the tariff screens (SCR-TAR-08, 09, 12 on the operations console, SCR-TAR-13 on the policy console, SCR-TAR-14
on the premises portal) need beyond links.

    actions.ts       Reproduce: the calculation again from what it recorded, or its refusal kept for the page
    console.ts       the catalogue's translator, the console's codes for components and classes, the workspace's tabs
    FeeSteps.tsx     SCR-TAR-14's six steps, refusals and header line, for the page opened from a decision and the
                     page opened from a review
    PrintButton.tsx  Print this page on SCR-TAR-14

With mock data the reads, the reproduction and the calculator run in `lib/mock/backend/tariff.ts`. Every fee REG
works out in the world (a review, a submission, an officer's outcome) is the calculator's, recorded with its shares,
factors, exemption, cap and rounding, and reproduced from what it recorded. The canvas's decisions keep the amounts
the canvas drew, read from REG's record.

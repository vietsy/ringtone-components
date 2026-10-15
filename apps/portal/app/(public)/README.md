# (public)

No credential, minimum disclosure (R19.3), and the strictest performance budget in the product:
300 KB total transfer against 200 KB of JavaScript per route elsewhere.

It is the page most likely to be opened on a poor connection by someone with no reason to wait -
an inspector standing in a venue, or a member of the public checking a certificate.

    page.tsx                  SCR-PUB-01  What RightOne is, the public site's home
    scope/                    SCR-PUB-02  Scope self-assessment
    indicative-amount/        SCR-PUB-03  Indicative amount
    verify/                   SCR-PUB-04  Verify a record, and SCR-PUB-05 under [reference]

The pages read the public service as the mock backend plays it (`lib/mock/backend/public.ts`): nobody
signs in, and what a reader declares or looks up is answered and never kept. `?view=` still shows any state
the canvas drew, for review.

`page.tsx` reads the "What RightOne is" page in effect today: version 2026.2, the legal basis and participant
list not offered yet, 2026.3 named as upcoming until 24 October 2026 (the canvas writes only its date, so
the mock keeps answering 2026.2 after it). `?view=` shows p1, populated, superseded, empty,
instant-invalid, loading and error; no control on the page reads it at another instant, so those states
are reached only that way. Its two ways on are the page's own: "Kiểm tra dịch vụ có áp dụng" (SCR-PUB-02)
and "Tra cứu" (SCR-PUB-04). Left out because their screens are not built: the "Đọc tuyên bố đầy đủ" link in "Một
con đường hợp pháp" (GOV-16), and the Biểu phí, Tài liệu pháp lý and Trợ giúp items of "Đi tiếp" (PUB-11,
PUB-10, PUB-12); the panel and "Tra cứu" stay. The help and contact pages do not exist either, so the
shell draws no footer. The authoritative contact in the empty view links as `mailto:`, the register's
address rather than a route.

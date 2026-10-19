# (public)

No credential, minimum disclosure (R19.3), and the strictest performance budget in the product:
300 KB total transfer against 200 KB of JavaScript per route elsewhere.

It is the page most likely to be opened on a poor connection by someone with no reason to wait -
an inspector standing in a venue, or a member of the public checking a certificate.

    page.tsx                  SCR-PUB-01  What RightOne is, the public site's home
    scope/                    SCR-PUB-02  Scope self-assessment
    indicative-amount/        SCR-PUB-03  Indicative amount
    verify/                   SCR-PUB-04  Verify a record, SCR-PUB-05 under [reference], SCR-PUB-06 under
                                          player/, SCR-PUB-07 under licence/ and proof/
    a/                        SCR-PUB-08  Public artist profile
    t/                        SCR-PUB-09  Public track page
    legal/                    SCR-PUB-10  Legal document library
    reports/                  SCR-PUB-11  Tariff and public disclosures; mandates/ is its second address
    estimate/                 SCR-PUB-03  the spec's address for the indicative amount
    help/                     SCR-PUB-12  Help, privacy and contacts, and SCR-PUB-13 under player/

The pages read the public service as the mock backend plays it (`lib/mock/backend/public.ts`): nobody
signs in, and what a reader declares or looks up is answered and never kept. `?view=` still shows any state
the canvas drew, for review.

`page.tsx` reads the "What RightOne is" page from the world's register (`lib/mock/backend/public.ts`, `GET /pages/ABOUT`),
which the policy console publishes into: the edition in effect with its own text (2026.2 holds OPERATOR, SCOPE and
ONE_LAWFUL_ROUTE; an edition approved on SCR-PUB-16 replaces it from its effective instant), the canvas's composition of
the sections read from their owners (the legal basis and participant list not offered yet), 2026.3 named as upcoming
until 24 October 2026; while a change to a source the page describes waits for the edition that describes it
(SCR-PUB-17), the page names the sources with a more recent approved version. 2026.1 and 2026.3 hold no text in the
register (the canvas writes theirs into this page's catalogue), so they are drawn with the catalogue's words. Opened as
at an instant (`?at=`, from the page history of SCR-PUB-10, which "Các phiên bản trước của trang này" opens), the page
shows the edition of that instant marked no longer current, with the version now current; a day not yet come is
INSTANT_INVALID. `?view=` shows p1, populated, superseded, empty, instant-invalid, loading and error. Its two ways on are
the page's own: "Kiểm tra dịch vụ có áp dụng" (SCR-PUB-02) and "Tra cứu" (SCR-PUB-04). "Đi tiếp" also holds Biểu phí
(SCR-PUB-11), Tài liệu pháp lý (SCR-PUB-10) and Trợ giúp (SCR-PUB-12). Left out because its screen is not built: the
"Đọc tuyên bố đầy đủ" link in "Một con đường hợp pháp" (GOV-16). The authoritative contact in the empty view links as
`mailto:`, the register's address rather than a route.

The shell's foot (`components/shells/PublicShell.tsx`) links Trợ giúp and Liên hệ (SCR-PUB-12), Quyền riêng tư
(its privacy journey) and Văn bản pháp lý (SCR-PUB-10) on every RightOne public page; the verification shell keeps
only Liên hệ. The help routes and the published versions of the legal documents and pages are per world, so the
public pages read the browser's world (`currentWorld()`).

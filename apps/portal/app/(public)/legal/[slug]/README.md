# [slug]

    page.tsx    SCR-PUB-10  Legal document library

The five documents, each at its address: premises-service-terms, artist-terms, rights-withdrawal,
takedown-process, privacy-notice. Any other address is DOCUMENT_KIND_UNKNOWN. The page reads the document as in
effect today, or as at `?at=` (a day that has not come, or is not a day, is INSTANT_INVALID); "Xem lịch sử" lists
the document's published versions (`?history=document`) and "Lịch sử trang chính sách" those of "What RightOne is"
(`?history=page`), each in place of the text.

The RightOne Player terms for premises are the versions VEN's services were accepted under (`lib/mock/venue.ts`):
version 1 from 1 June 2026, 2 from 1 August and 3 in effect from 1 September 2026, so the page opens on version 3
with its text (SCR-VEN-02's, the text a premises accepts) and digest, its history lists 3, 2 and 1, and each listed
version opens as at the day it took effect, marked no longer current beside version 3. No other legal document is
referenced by any record, and none has a published version: each says no version existed at that time. The page
history lists "What RightOne is": 2026.3 (upcoming 24 October 2026), 2026.2 (in effect, linking the home page) and
2026.1 (1 July to 14 September 2026). The privacy notice is DAT's, which DAT does not offer yet: SOURCE_UNAVAILABLE,
with the line that the privacy-rights route stays open and a link to SCR-PUB-12's privacy journey. Versions are per
world (`lib/mock/backend/public.ts`, `public-documents`), so a version published into it shows here.

`?view=` shows any view the canvas drew: p1-no-version, p1-privacy-not-offered, in-effect, superseded, history,
page-history, kind-unknown, loading.

Deviations: the canvas gives no date for versions 1 and 2; each is taken as the first of the month it was first
accepted in, and their text is SCR-PUB-10's earlier text. The board's own version labels (2026.1 to 2026.3) are its
review views (`?view=in-effect`, `superseded`, `history`). The history panel's title is "Các phiên bản của tài liệu
này" for every document, where the board writes "Các phiên bản của điều khoản". On a refused address the two
history buttons are left out: there is no document to list.

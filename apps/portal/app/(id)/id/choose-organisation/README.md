# choose-organisation

    page.tsx    SCR-RID-04  Choose an organisation

Every view the canvas drew is reachable as `?view=`: list (the default), working, invalid, empty,
loading, error; `?client=none` with mock data.

"Tiếp tục tới RightOne" stays disabled, saying "Chọn một tổ chức ở trên để tiếp tục.", until an
organisation is chosen, as the canvas's list view draws it; `OrganisationPicker` (a client component)
holds the choice and enables it. It submits to `continueToRightOne`, which opens the premises portal
(`routes.applications()`). A refused organisation (invalid) keeps its error until another is chosen.

Deviation: the consent link in "Ứng dụng nào cần bạn cho phép thì hỏi quyền truy cập tài khoản ở bước kế
tiếp." (RID-29) is dropped; the sentence stays, as it still reads true.

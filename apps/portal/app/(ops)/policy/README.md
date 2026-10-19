# policy

The policy console ("Chính sách"), one directory per workspace of its rail (`components/shells/ops-nav.ts`).

    page.tsx                 SCR-PUB-14  public documents, the console's landing: each document's version in
                                         effect, upcoming and open, filtered by class and by a version's state
    documents/               SCR-PUB-15  the version editor opened from "Soạn phiên bản mới", before the version exists
    versions/                SCR-PUB-15  the version editor; SCR-PUB-16 approving a version, under review/
    currency/                SCR-PUB-17  publication currency: the approved changes and when each reached the public pages
    mandate-scope-changes/   SCR-TAR-13  mandate scope changes
    engagement/              SCR-ENG-06, 07, 13  award rule versions and their editor, disclosure versions (the
                                         Engagement rules workspace)

Public documents and their versions are the public service's (`lib/mock/backend/public.ts`): a version published here
is the one SCR-PUB-10, 13 and VEN-02 read from its effective instant, in the same browser's world.

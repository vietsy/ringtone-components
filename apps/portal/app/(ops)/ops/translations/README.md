# translations

    page.tsx   SCR-SVC-21  the translation register on the operations console: the translations of the content key typed
               (`?content=`, the publishing module's key, PREMISES_SERVICE_TERMS), current ones first, each with the
               Vietnamese version it was approved against and whether that version is still in force; Ghi bản dịch
               (`?record=`) records an approved translation against an approved Vietnamese version.

The Vietnamese versions are PUB's: a version approved on the policy console is offered here, and once a later one takes
effect every translation against the earlier one reads superseded, with the instant and the version that superseded it.
A draft or a version awaiting approval is refused SOURCE_VERSION_NOT_APPROVED, a second translation into one language
against one version TRANSLATION_ALREADY_RECORDED, and a key nothing is published under CONTENT_NOT_FOUND; each attempt
is attributed. `?view=loading` and `error` draw those states for review.

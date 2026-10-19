# Mandate Detail

- `MandateDetailPage.tsx`: server entry; session, route/query, locale/frame, API read, missing-record
  handling and the signed-in account passed to the client. The existing session gate stays in place; reviewer permissions are
  deferred. Even the loading review validates the requested record before showing a specimen.
- `MandateDetailClient.tsx`: all detail UI in one component as requested: scope, timeline, evidence,
  period and approval. It uses `GovernanceShell`, shared with the register, for the twelve-entry administration rail,
  search, mock queue and existing VI/EN locale switch. It composes R1 components, including copy, provenance,
  file metadata and dates. Unimplemented navigation destinations show an explicit unavailable-screen dialog.
- `types.ts`: the framework and client prop contracts. Data contracts stay in `lib/api/mandate-detail`.
- `MandateDetail.module.css`: local classes for page layout, frame variants, table column widths and
  evidence typography. Page and Client contain no inline styles; all design lengths use R1 tokens.

The thin route is `/org/mandate/detail/[mandateId]`. The sample ID is `appa`. Data comes through
the API helper, never by importing fixtures into UI. Mock data is gated by `RIGHTONE_DATA=mock`.
Messages are the `messages/screens/mandate-detail.{vi,en}.json` pair.

Review views: `submitted`, `loading`, `empty`, `error`. Invalid or absent views load normally.
`empty` retains the record and empties only its scope. Unknown IDs are not-found, even in review mode.
`frame=phone` stacks the columns and uses scope cards; `frame=tablet` stacks the columns with a table.
Widths, gaps and panel insets use existing tokens; flexible columns can also wrap in a narrow container.

The Sổ uỷ quyền breadcrumb returns to `/org/mandate/register`.
The evidence link remains `#` until its real URL is supplied. The disabled coverage action keeps the
design's explanation. Approve and Record insufficient evidence remain enabled as requested; this UI
iteration does not connect reviewer permissions or write commands, or invent dialogs absent from Figma.

Every icon is supplied by the matching R1 component; no temporary Figma image URLs are shipped.

Start sample mode from the repository root in PowerShell:

```powershell
$env:RIGHTONE_DATA = 'mock'
pnpm --filter @rightone/portal dev
```

Sign in using a sample organisation account from `apps/portal/README.md`, then open:

- `/org/mandate/detail/appa?view=submitted`
- `/org/mandate/detail/appa?view=empty&frame=phone`
- `/org/mandate/detail/appa?view=error&frame=tablet`

Use the shell's VI/EN switch; locale is stored in `r1-locale`, not a URL prefix or query.

Verification includes production build/type checking, scoped ESLint, the portal message/theme tests,
and browser checks of both locales, review states, invalid/absent queries, unknown IDs, the register breadcrumb, copy by keyboard, enabled review controls and the disabled coverage explanation.
Phone widths 320/390 and tablet width 768 have no page-level horizontal overflow. These checks are
not a complete WCAG audit; no axe suite is configured yet.

The design-system-use check permits the requested CSS Module only for these two detail components.
Its paths are normalised across Windows and POSIX; the token and component checks remain in place.

## Screenshot alignment

The desktop scope table keeps right-type labels on one line and gives territories room to fit.
Fact labels and values use the board's equal-column split, and the authority identifier uses the
small R1 size so its copy control stays beside the code. Evidence row spacing uses existing tokens.
Mock queue count 6 is only supplied when the server confirms `RIGHTONE_DATA=mock`; signed-in
account details and sign-out remain session-driven. Unimplemented approvals and evidence URLs
remain API integration work, not simulated successful writes or fabricated documents.

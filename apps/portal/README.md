# portal

One Next.js application carrying all five surfaces, separated by route group.

| Route group | Surface | Dominant constraint |
|---|---|---|
| `(public)` | verification, no credential | minimum disclosure, works on a poor mobile connection |
| `(premises)` | premises principals and delegates | non-technical users; comprehensible without training |
| `(artist)` | artists and direct licensors | self-service upload and rights declaration |
| `(org)` | rights organisation administrators | bulk operations, data-quality feedback |
| `(ops)` | operations, case, finance and policy officers | density, keyboard-driven work |

The operations console is the surface most likely to be designed badly, because its users are
internal and their complaints are cheap to ignore. It is also where an officer spends six hours a
day, which makes density and keyboard operation requirements there rather than preferences.

## Server by default

A client component is justified by interactivity, not by habit. Data fetching, authority decisions
and anything touching a secret stay on the server. Hiding a button is presentation, not
authorisation (R4.2): the server refuses regardless of what the client renders.

## Running the portal on mock data

There is no API yet, so the portal can run on a mock backend that behaves as the API will: sign in, act,
and the next screen shows what the act did. Every page says at its foot that its data is sample data.

    RIGHTONE_DATA=mock pnpm --filter @rightone/portal dev

Open `http://localhost:3000/` (use `localhost`, not `127.0.0.1`: the development server serves its scripts
to the origin it announced, and a page opened on the other one never hydrates). The accounts are the design
canvas's people:

| Account | Password | Signs in to |
|---|---|---|
| `trang.do@thencuaviet.vn` | `Hem214-chieu-mua` | the premises portal, after choosing Công ty TNHH Then Cửa Việt |
| `ngocdiep.au@kiemtra.example` | `KTVH-0418-kiemtra` | the inspector's field client (`/field`) and console (`/inspection/lists`) |
| `baotran.la@lamhong.example` | `LamHong-PTC-0107` | the organisation portal (`/org`) as Lam Hồng, a rights organisation that participates |
| `thimai.doan@hacbach.example` | `HacBach-UyQuyen-26` | the organisation portal as Hạc Bạch, submitting its mandate and terms |
| `lanchi.mac@dayan.example` | `DayDan-ThamGia-26` | the organisation portal as Dây Đàn, applying to participate |

Registering a new account writes its confirmation link to the server's log (there is no mail); open it to
confirm the account. Each sign-in starts from the canvas's data and keeps what is done in it until sign-out;
restarting the server forgets everything.

For design review, any page that loads data draws any state its board drew with `?view=<state>`, and
`?frame=phone` or `?frame=tablet` lays it out for that device. `/design-system` shows every component of the
design system R1. Without `RIGHTONE_DATA=mock` every seam returns `SERVICE_NOT_CONFIGURED`, nobody can sign in,
`?view=` is ignored and `/design-system` answers 404.

A production build is a standalone server (`output: "standalone"`), so `next start` does not serve it:

    pnpm --filter @rightone/portal build
    RIGHTONE_DATA=mock node apps/portal/.next/standalone/apps/portal/server.js

The standalone server serves no static assets of its own; copy `apps/portal/.next/static` to
`apps/portal/.next/standalone/apps/portal/.next/static` first, as the container image does.

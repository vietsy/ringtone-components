# Security

Report privately to TODO(owner)@example.invalid, or through GitHub's private advisory form. Never in
a public issue.

## What is especially sensitive here

| Class | Why |
|---|---|
| A token, secret or session value reaching a client component | R23.6. A leaked access token from a session callback is a defect class that has occurred in a sibling repository |
| A public surface disclosing a field outside the approved disclosure profile | R19.3. Public verification is read by people with no relationship to the service |
| Authority decided in the browser | R4.2. Hiding a button is presentation. The server refuses regardless of what the client renders |

`NEXT_PUBLIC_` is for values that are genuinely public - an analytics key, a public base URL - and
never for anything else.

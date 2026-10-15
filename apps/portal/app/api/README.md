# api

Route handlers the portal serves itself. Product data does not come from here: it comes from
`rightone-api` through the generated client. What lives here is what the platform asks of every
service it runs.

    health/   liveness, and which build is running

# docker

`Dockerfile.portal` builds the portal image. Jenkins builds it once on every merge to `main`
(`Jenkinsfile.harbor`), pushes it to Harbor by digest, and puts that digest into the DEV
environment on node-21. UAT takes what DEV runs, by a promotion a person starts. platform-infra
`ADR-0025` and its runbook `rightone-env.md` have the rest: where the two environments are, the
record of every deploy, and how to go back.

    docker build -f deploy/docker/Dockerfile.portal -t rightone-portal .
    docker run --rm -p 3000:3000 rightone-portal
    curl http://localhost:3000/api/health

The build context is the repository root, because the portal depends on the workspace packages
under `packages/`.

**What is in the image.** The Next.js standalone server and the files it traced, nothing else: no
source, no dev dependencies, no package manager. It runs as the unprivileged `node` user and
listens on 3000.

**What is not.** Any setting that differs between environments. Those are read from the
environment when a request arrives. A `NEXT_PUBLIC_*` variable is inlined at build time, so one
that differed between environments would force one image per environment; none may.

There is no `public/` directory yet. The day one is added, the runtime stage needs a `COPY` for it.

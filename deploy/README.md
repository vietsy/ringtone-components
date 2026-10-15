# deploy

How the portal becomes something that runs.

    docker/   the image definition

Environment-specific configuration, secrets and the Compose file live in `platform-infra`, never
here. This repository produces one image; the same digest runs in DEV, UAT and production.

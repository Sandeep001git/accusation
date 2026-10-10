# Docker guide

This project uses Docker Compose for local development and production. Docker
Compose v2 and a running Docker Engine are required.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` for pushes, pull requests, and
manual runs. The workflow uses Node.js `24.15.0` and the committed npm lockfile.
It runs linting, tests, dependency audits, production Compose validation, and
builds both the migration and production Docker images. Test coverage is
uploaded as a short-lived workflow artifact.

The workflow uses only read access to repository contents and does not receive
production credentials. The current repository configuration identifies Neon
as the database provider but does not identify a hosting target or registry for
the API. Therefore, it intentionally does not deploy or publish images.
Configure the actual hosting target, protected production environment, and its
minimum required credentials before adding a deployment job. Database
migrations should remain a deliberate deployment step and must not run against
production from untrusted pull requests.

The production dependency audit currently reports no vulnerabilities. The
full dependency audit reports moderate transitive advisories in development
tools; it reports them in CI and fails on high or critical advisories rather
than forcing breaking dependency downgrades.

## Development

1. Create `.env.development` and set development-only credentials. The
   development Compose file expects `NEON_API_KEY`, `NEON_PROJECT_ID`, and
   `BRANCH_ID` for Neon Local. `PARENT_BRANCH_ID` and `DELETE_BRANCH` are
   optional; they default to `main` and `true`.
2. Use a dedicated Neon development branch. Do not use production credentials
   or a production branch for local development.
3. Start the stack:

   ```sh
   bash scripts/dev.sh
   ```

The script builds and starts the services in the foreground. It starts
`neon-local`, applies database migrations, then starts the API with source
watching enabled. The API is available at `http://127.0.0.1:3001`. Press
`Ctrl+C` to stop the foreground stack.

The API and migration containers connect to Neon Local at
`neon-local:5432` over the Compose network. Neon Local is not published on a
host port. Compose maps host port `3001` to port `3000` in the API container.
The `.neon_local/` folder stores local Neon metadata and is ignored by Git.

Useful development commands:

```sh
# Show running containers
docker compose --project-name accusation-dev --env-file .env.development -f compose.dev.yaml ps

# Follow logs from all services, or choose neon-local, migrate, or app
docker compose --project-name accusation-dev --env-file .env.development -f compose.dev.yaml logs --follow
docker compose --project-name accusation-dev --env-file .env.development -f compose.dev.yaml logs --follow app

# Stop and remove the containers and network
docker compose --project-name accusation-dev --env-file .env.development -f compose.dev.yaml down
```

Stopping the stack does not delete the Neon database branch or the
`.neon_local/` metadata directory.

## Production

1. Set production-only values in `.env.production`. At minimum, the helper
   checks for `DATABASE_URL`, `JWT_SECRET`, and `ARCJET_API_KEY`. Use real,
   secure values; do not commit the file.
2. Start the production stack:

   ```sh
   bash scripts/prod.sh up
   ```

The helper asks for confirmation before starting production. The optional
`--yes` argument skips that prompt and is intended for deliberate
non-interactive use:

```sh
bash scripts/prod.sh up --yes
```

Compose applies checked-in Drizzle migrations before starting the API. The API
is available on `http://127.0.0.1:3000`, bound to loopback only. Put a properly
configured reverse proxy in front of it if it must be accessible remotely.
PostgreSQL remains hosted by Neon; this Compose setup does not run a database
container.

Useful production commands:

```sh
bash scripts/prod.sh status
bash scripts/prod.sh health
bash scripts/prod.sh logs
bash scripts/prod.sh restart
bash scripts/prod.sh down
```

`down` asks for confirmation, removes the containers and network, and does not
delete data in Neon. Add `--yes` to `down` only when deliberately running
non-interactively.

To validate production Compose settings without starting containers:

```sh
docker compose --project-name accusation-prod --env-file .env.production -f compose.prod.yaml config --quiet
```

## Dockerfile stages

- `development` installs project dependencies; Compose mounts the source and
  runs the API in watch mode.
- `migrate` includes Drizzle migration tooling and schema files, and runs the
  database migrations as a one-shot service.
- `production` contains production dependencies and application source. It
  runs as the unprivileged `node` user and includes a health check.

The `.dockerignore` file keeps environment files, dependencies, logs, and
generated output out of the Docker build context. Keep database migration
files in version control: the migration image needs them to update the
database.

## Troubleshooting

Check that Docker and Compose are available:

```sh
docker --version
docker compose version
```

If development migrations fail, inspect Neon Local and migration logs:

```sh
docker compose --project-name accusation-dev --env-file .env.development -f compose.dev.yaml logs neon-local migrate
```

If production does not become healthy, inspect the service status and logs:

```sh
bash scripts/prod.sh status
bash scripts/prod.sh logs
```

# Accusation API

Node.js and Express API backed by Neon PostgreSQL. Docker Compose builds the
production API image and runs Drizzle migrations before the API starts.

## Configuration

Two local environment files are provided:

- `.env.development` is used by `npm run dev`.
- `.env.production` is used by `npm start` and Docker Compose.

Replace the placeholders in each file before use. Configure development to use a
dedicated development database or Neon branch, and keep development and
production secrets separate. The production file currently contains placeholders;
populate it with the approved production settings before running Compose.

| Variable          | Required   | Purpose                                                                                                   |
| ----------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | Yes        | PostgreSQL connection URL. Use the connection URL and SSL settings recommended by your database provider. |
| `NEON_API_KEY`    | Docker dev | Neon API key used by Neon Local. Keep it private.                                                         |
| `NEON_PROJECT_ID` | Docker dev | Neon project containing the development branch.                                                           |
| `BRANCH_ID`       | Docker dev | ID of a persistent, dedicated development branch.                                                         |
| `JWT_SECRET`      | Yes        | Secret used to sign authentication tokens. Generate a unique, strong value for each environment.          |
| `ARCJET_API_KEY`  | Yes        | API key used by the Arcjet security middleware.                                                           |
| `PORT`            | No         | Application port; defaults to `3000`.                                                                     |
| `NODE_ENV`        | No         | Runtime mode; set to `development` or `production` as appropriate.                                        |
| `LOG_LEVEL`       | No         | Winston logging level; for example, `debug` in development and `info` in production.                      |

Environment files are excluded from Git and the Docker build context. Do not
commit them, place secrets in the Dockerfile, or include secret values in logs or
support requests. `.env.example` is the shareable template.

## Development with Docker Compose

Configure `.env.development` with development-only credentials and a dedicated
development database, then build and start the stack with one command:

```sh
bash scripts/dev.sh
```

This starts Neon Local, applies development database migrations through the
proxy, starts the API in watch mode, and reloads it when source files change.
The API is available at `http://127.0.0.1:3001`.
Inside Docker, the API listens on port `3000`; Compose maps host port `3001` to it.
Neon Local is a Compose service, not an app folder, and is not published on a
host port. `BRANCH_ID` must identify an existing development branch, separate
from production; using a fixed branch preserves dev data between restarts.
Compose overrides `DATABASE_URL` with the local proxy address and the
`neondb_owner` username required by the Neon serverless driver.
Press `Ctrl+C` to stop the foreground stack. To stop containers later, run
`docker compose --project-name accusation-dev --env-file .env.development -f compose.dev.yaml down`.

If migrations fail, inspect both services:

```sh
docker compose --project-name accusation-dev --env-file .env.development -f compose.dev.yaml logs neon-local migrate
```

To run without Docker, install dependencies and start the same development
command:

```sh
npm ci
npm run dev
```

Both development workflows load `.env.development`.
Only the Compose services set `USE_NEON_LOCAL=true`, which directs the Neon
serverless driver to the `neon-local` proxy. Running `npm run dev` directly
does not set that flag and uses the direct `DATABASE_URL` from
`.env.development`.

## Production with Docker Compose

After configuring `.env.production`, build and start the services:

```sh
docker compose --project-name accusation-prod -f compose.prod.yaml up --build
```

Compose loads runtime settings from `.env.production`. The API is published on
`127.0.0.1:3000` only; use an appropriately configured reverse proxy if the
service needs remote access. If you change `PORT`, update the Compose port
mapping to match. Pass `-f compose.prod.yaml` to each production Compose command.

The production Compose file (`compose.prod.yaml`) includes:

- `migrate`: a one-shot Drizzle migration service. The API waits for successful
  completion before it starts.
- `backend`: the production API container, running as a non-root user with a
  database-backed health check.

PostgreSQL remains hosted by Neon; Compose does not create or expose a database
container. Stopping Compose does not remove database data.

## Verify and operate

Check container state and application readiness:

```sh
docker compose --project-name accusation-prod -f compose.prod.yaml ps
curl --fail http://127.0.0.1:3000/health
```

The readiness endpoint returns HTTP 200 when the API can query the database and
HTTP 503 when the database is unavailable. You can also check the API routes:

```sh
curl --fail http://127.0.0.1:3000/
curl --fail http://127.0.0.1:3000/api
```

View logs, restart the API, or stop the stack:

```sh
docker compose --project-name accusation-prod -f compose.prod.yaml logs
docker compose --project-name accusation-prod -f compose.prod.yaml restart
docker compose --project-name accusation-prod -f compose.prod.yaml down
```

`down` removes the containers and network. It does not remove data hosted by
Neon.

## Database migrations

`up` applies checked-in migrations before starting the API. To run the migration
service separately, use the environment-specific command so Drizzle receives
the intended database URL:

```sh
npm run db:migrate:prod
```

`npm run db:migrate:dev` targets `.env.development`, and
`npm run db:migrate:prod` targets `.env.production`. The Compose migration
container receives its URL from `.env.production` and runs `npm run db:migrate`.
The email uniqueness migration requires existing user emails to be unique;
resolve any duplicates in the target database before applying it.

After adding or changing a migration, apply it to the intended environment and
then restart the matching API:

```sh
npm run db:migrate:prod
docker compose --project-name accusation-prod -f compose.prod.yaml restart
```

The migration service uses Drizzle Kit from the development dependencies. The
production API image excludes migration tooling and migration files.

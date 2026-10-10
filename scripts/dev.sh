#!/usr/bin/env bash
set -euo pipefail

# Always run from the project folder, even if this script is called elsewhere.
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# Docker Compose is used to start the API and Neon Local together.
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop/Engine and try again." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Update your Docker installation." >&2
  exit 1
fi

# The development settings contain the Neon Local credentials.
if [[ ! -f "${ROOT}/.env.development" ]]; then
  echo "Missing .env.development. Create it from .env.example and set your development values." >&2
  exit 1
fi

# Start Neon Local, apply migrations, then run the API with live source reload.
echo "Starting Neon Local, applying development migrations, then starting the API..."
echo "Development API will be available at http://127.0.0.1:3001"
exec docker compose \
  --project-name accusation-dev \
  --env-file "${ROOT}/.env.development" \
  --file "${ROOT}/compose.dev.yaml" \
  up --build

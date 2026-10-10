#!/usr/bin/env bash
set -eu

# Resolve the repository root so this works from any current directory.
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop/Engine and try again." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Update your Docker installation." >&2
  exit 1
fi

if [ ! -f "${ROOT}/.env.development" ]; then
  echo "Missing .env.development. Create it from .env.example and set your development values." >&2
  exit 1
fi

echo "Starting Neon Local, applying development migrations, then starting the API..."
echo "Development API will be available at http://127.0.0.1:3001"
exec docker compose \
  --project-name accusation-dev \
  --env-file "${ROOT}/.env.development" \
  --file "${ROOT}/compose.dev.yaml" \
  up --build

#!/usr/bin/env bash
set -euo pipefail

# Move to the project folder so Compose can find its files.
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# These names match the production Compose project and files.
ENV_FILE=".env.production"
COMPOSE_FILE="compose.prod.yaml"
PROJECT_NAME="accusation-prod"

# Use "up" when no command is given.
COMMAND="${1:-up}"
CONFIRM_WITH_YES="${2:-}"

# Help should work even before Docker or production settings are installed.
if [[ "${COMMAND}" == "help" ]]; then
  echo "Usage: bash scripts/prod.sh [up|build|status|logs|restart|health|down|help] [--yes]"
  echo "The default command is 'up'. Production start/stop asks for confirmation."
  exit 0
fi

# Check Docker and the production settings before using Compose.
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop/Engine and try again." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Update your Docker installation." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it from .env.example and add production settings." >&2
  exit 1
fi

# Check that the main settings are present before starting production.
for NAME in DATABASE_URL JWT_SECRET ARCJET_API_KEY; do
  if ! grep -Eq "^${NAME}=.+" "${ENV_FILE}"; then
    echo "Add ${NAME} to ${ENV_FILE} before starting production." >&2
    exit 1
  fi
done

# This short command reuses the same production project and settings each time.
compose() {
  docker compose \
    --project-name "${PROJECT_NAME}" \
    --env-file "${ENV_FILE}" \
    --file "${COMPOSE_FILE}" \
    "$@"
}

# Starting runs migrations; stopping removes production containers.
# Confirm these actions unless the command includes "--yes".
confirm_production_action() {
  local action="$1"
  local answer

  if [[ "${CONFIRM_WITH_YES}" == "--yes" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    echo "Run this command in a terminal, or add --yes to confirm." >&2
    exit 1
  fi

  read -r -p "This will ${action} the production stack. Continue? [y/N] " answer
  if [[ "${answer}" != "y" && "${answer}" != "Y" ]]; then
    echo "Cancelled."
    exit 1
  fi
}

# Check the Compose file before running the requested action.
compose config --quiet

case "${COMMAND}" in
  up)
    confirm_production_action "start"
    echo "Building and starting the production API..."
    compose up --build --detach
    echo "API is available at http://127.0.0.1:3000"
    ;;
  build)
    compose build
    ;;
  status)
    compose ps
    ;;
  logs)
    compose logs --follow "${2:-backend}"
    ;;
  restart)
    if [[ -n "${2:-}" ]]; then
      compose restart "$2"
    else
      compose restart
    fi
    ;;
  health)
    if ! command -v curl >/dev/null 2>&1; then
      echo "curl is required for the health check." >&2
      exit 1
    fi
    curl --fail --silent --show-error http://127.0.0.1:3000/health
    echo
    ;;
  down)
    confirm_production_action "stop and remove"
    compose down
    ;;
  help)
    echo "Usage: bash scripts/prod.sh [up|build|status|logs|restart|health|down|help] [--yes]"
    echo "The default command is 'up'. Production start/stop asks for confirmation."
    ;;
  *)
    echo "Unknown command: ${COMMAND}" >&2
    echo "Run 'bash scripts/prod.sh help' to see available commands." >&2
    exit 1
    ;;
esac

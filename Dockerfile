# Install dependencies in a separate layer to keep application source out of
# the dependency cache.
FROM node:24.15.0-bookworm-slim AS dependencies

WORKDIR /app

# bcrypt may need these tools when npm installs its native module.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# Development dependencies and source are mounted by Compose.
FROM dependencies AS development

ENV NODE_ENV=development

RUN mkdir -p logs

# Keep migration tooling and schema assets out of the production API image.
FROM dependencies AS migrate

ENV NODE_ENV=production

COPY --chown=node:node drizzle.config.js ./
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node src/models ./src/models
COPY --chown=node:node src/config/database.js ./src/config/database.js
COPY --chown=node:node scripts/migrate-local.js ./scripts/migrate-local.js

USER node

CMD ["npm", "run", "db:migrate"]

# Resolve only production dependencies for the final runtime image.
FROM node:24.15.0-bookworm-slim AS production-dependencies

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

# Run as the unprivileged Node user; configuration is injected at runtime.
FROM node:24.15.0-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

RUN mkdir -p logs && chown node:node logs

USER node

EXPOSE 3000

# The readiness route returns success only after it can query the database.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "const port = process.env.PORT || 3000; fetch('http://127.0.0.1:' + port + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/index.js"]

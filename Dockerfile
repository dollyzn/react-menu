# syntax=docker/dockerfile:1.7
#
# Multi-target build for the monorepo:
#   docker build --target api .   → AdonisJS API (production)
#   docker build --target web .   → Next.js web, standalone server (production)
#   docker build --target dev .   → toolchain for docker-compose.dev.yml (profile "app")

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /repo
# Installs the pnpm version pinned in package.json#packageManager once, in the image.
COPY package.json ./
RUN corepack enable && corepack install

# ---- dependencies (cached until a manifest or the lockfile changes) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ---- API ----
FROM deps AS build-api
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @react-menu/api build

FROM base AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter @react-menu/api...
# The compiled app (with its own package.json and import map) replaces the sources.
COPY --from=build-api /repo/apps/api/build apps/api/
COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint
RUN mkdir -p apps/api/storage && chown -R node:node apps/api/storage
USER node
WORKDIR /repo/apps/api
EXPOSE 3333
ENTRYPOINT ["api-entrypoint"]
CMD ["node", "bin/server.js"]

# ---- Web ----
FROM deps AS build-web
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BUILD_VERSION=docker
ARG NEXT_PUBLIC_API_TIMEOUT=60000
ARG NEXT_PUBLIC_AUTH_COOKIE_NAME=session-token
ARG NEXT_PUBLIC_STORAGE_BASE_NAME=menu-app
ARG NEXT_PUBLIC_PAGE_SIZES="[10, 20, 30, 40, 50]"
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_VAPID_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BUILD_VERSION=$NEXT_PUBLIC_BUILD_VERSION \
    NEXT_PUBLIC_API_TIMEOUT=$NEXT_PUBLIC_API_TIMEOUT \
    NEXT_PUBLIC_AUTH_COOKIE_NAME=$NEXT_PUBLIC_AUTH_COOKIE_NAME \
    NEXT_PUBLIC_STORAGE_BASE_NAME=$NEXT_PUBLIC_STORAGE_BASE_NAME \
    NEXT_PUBLIC_PAGE_SIZES=$NEXT_PUBLIC_PAGE_SIZES \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_FIREBASE_VAPID_KEY=$NEXT_PUBLIC_FIREBASE_VAPID_KEY \
    NEXT_OUTPUT=standalone
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN pnpm --filter @react-menu/web build

FROM node:${NODE_VERSION}-slim AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build-web --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build-web --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ---- Development toolchain (sources are bind-mounted) ----
FROM base AS dev
ENV NODE_ENV=development

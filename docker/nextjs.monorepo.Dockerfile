# =============================================================================
# Next.js Standalone Production Image - npm Monorepo
# =============================================================================
# Multi-stage build that handles npm workspaces by building inside Docker.
#
# Build args:
#   - APP_NAME: Name of the app directory (e.g., app, web-site, docs)
#
# Usage:
#   docker build -f docker/nextjs.monorepo.Dockerfile \
#     --build-arg APP_NAME=web-site \
#     -t myapp .
# =============================================================================

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# -----------------------------------------------------------------------------
# Stage 1: Install dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy all package.json and lockfile first (for layer caching)
COPY package.json package-lock.json ./
COPY .npmrc* ./
COPY turbo.json ./

# Copy all workspace package.json files
COPY apps/ ./apps/
COPY packages/ ./packages/

# Install dependencies with cache mount for npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# -----------------------------------------------------------------------------
# Stage 2: Build the application
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

ARG APP_NAME=app

# Copy everything from deps (includes node_modules)
COPY --from=deps /app ./

# Build the specific app using turbo
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx turbo run build --filter=@modulariot/${APP_NAME}

# -----------------------------------------------------------------------------
# Stage 3: Production runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ARG APP_NAME=app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets (may not exist for all apps)
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/public ./public

# Copy standalone build output
# With outputFileTracingRoot pointing to monorepo root, standalone includes full structure
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./

# Copy static files to correct location
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static

# Copy public to app location as well (for basePath routing)
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run from the app directory where server.js is located
WORKDIR /app/apps/${APP_NAME}
CMD ["node", "server.js"]

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
# Stage 1: Extract workspace package.json files only
# -----------------------------------------------------------------------------
FROM base AS manifests
WORKDIR /app
COPY apps/ ./apps/
COPY packages/ ./packages/
RUN find . -not -name "package.json" -not -type d -delete && \
    find . -empty -type d -delete

# -----------------------------------------------------------------------------
# Stage 2: Install dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy root package.json, lockfile, and configs (for layer caching)
COPY package.json package-lock.json ./
COPY turbo.json ./

# Note: .npmrc not needed - empty config file
# If custom npm config is needed in future, create it inline:
# RUN echo "registry=https://registry.npmjs.org/" > .npmrc

# Copy only workspace package.json files (no source code)
COPY --from=manifests /app/apps ./apps
COPY --from=manifests /app/packages ./packages

# Install dependencies with cache mount for npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# -----------------------------------------------------------------------------
# Stage 3: Build the application
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

ARG APP_NAME=app

# SECURITY NOTE: NEXT_PUBLIC_* variables are PUBLIC by design (Next.js convention)
# They are embedded in the client-side JavaScript bundle and are NOT secrets.
# These are Mapbox public API keys and public URLs intended for browser use.
#
# ⚠️  NEVER use ARG for actual secrets (DB passwords, private API keys, etc.)
# Secrets should be provided at RUNTIME via environment variables, not build-time.
ARG NEXT_PUBLIC_INGEST_URL
ARG NEXT_PUBLIC_MAPBOX_API_KEY

# Copy installed dependencies and manifests from deps stage
COPY --from=deps /app ./

# Copy full source code (only this layer invalidates on code changes)
COPY apps/ ./apps/
COPY packages/ ./packages/

# Build the specific app using turbo
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx turbo run build --filter=@modulariot/${APP_NAME}

# -----------------------------------------------------------------------------
# Stage 4: Production runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ARG APP_NAME=app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy files as root first (for security)
COPY --from=builder /app/apps/${APP_NAME}/public ./public
COPY --from=builder /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

# Set ownership and remove write permissions to prevent tampering
# Files are read-only (555 = r-xr-xr-x) - nextjs user can read/execute but not modify
RUN chown -R nextjs:nodejs /app && \
    chmod -R 555 /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run from the app directory where server.js is located
WORKDIR /app/apps/${APP_NAME}
CMD ["node", "server.js"]

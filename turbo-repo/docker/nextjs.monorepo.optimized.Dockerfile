# =============================================================================
# Next.js Standalone Production Image - npm Monorepo (OPTIMIZED)
# =============================================================================
# Multi-stage build using turbo prune for optimal build times and image size.
#
# Key optimizations:
#   1. Uses turbo prune to create minimal subset for each app
#   2. Better layer caching by separating dependencies from source
#   3. Only installs dependencies needed for the target app
#   4. Significantly faster builds and smaller final images
#
# Build args:
#   - APP_NAME: Name of the app directory (e.g., app, web-site, docs)
#
# Usage:
#   docker build -f docker/nextjs.monorepo.optimized.Dockerfile \
#     --build-arg APP_NAME=web-site \
#     -t myapp .
# =============================================================================

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 1: Prune - Extract only what's needed for the target app
# -----------------------------------------------------------------------------
FROM base AS pruner
RUN npm install -g turbo

# Copy only necessary files for turbo prune (explicit to avoid sensitive data)
COPY package.json package-lock.json turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

ARG APP_NAME=app

# Prune the monorepo to include only the target app and its dependencies
RUN turbo prune @modulariot/${APP_NAME} --docker

# -----------------------------------------------------------------------------
# Stage 2: Install dependencies
# -----------------------------------------------------------------------------
FROM base AS installer

# Copy pruned lockfile and package.json files
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/package-lock.json ./package-lock.json

# Note: .npmrc not needed - empty config file
# If custom npm config is needed in future, create it inline:
# RUN echo "registry=https://registry.npmjs.org/" > .npmrc

# Install dependencies (only for the pruned subset)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Copy pruned source code
COPY --from=pruner /app/out/full/ ./

# Copy turbo config
COPY turbo.json ./

# -----------------------------------------------------------------------------
# Stage 3: Build the application
# -----------------------------------------------------------------------------
FROM base AS builder

ARG APP_NAME=app

# SECURITY NOTE: NEXT_PUBLIC_* variables are PUBLIC by design (Next.js convention)
# They are embedded in the client-side JavaScript bundle and are NOT secrets.
# These are Mapbox public API keys and public URLs intended for browser use.
#
# ⚠️  NEVER use ARG for actual secrets (DB passwords, private API keys, etc.)
# Secrets should be provided at RUNTIME via environment variables, not build-time.
ARG NEXT_PUBLIC_INGEST_URL
ARG NEXT_PUBLIC_MAPBOX_API_KEY

# Copy installed dependencies and source
COPY --from=installer /app ./

# Build the specific app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx turbo run build --filter=@modulariot/${APP_NAME}

# Ensure public directory exists (some apps may not have one)
RUN mkdir -p /app/apps/${APP_NAME}/public

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
COPY --from=builder /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder /app/apps/${APP_NAME}/public ./public
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

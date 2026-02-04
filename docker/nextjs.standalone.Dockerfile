# =============================================================================
# Next.js Standalone Production Image
# =============================================================================
# This Dockerfile is used by the CI to build standalone Next.js applications.
# It expects the build artifacts to be pre-built and copied into the context.
#
# Build context should contain:
#   - .next/standalone/ - The standalone build output
#   - .next/static/     - Static files
#   - public/           - Public assets
#
# Build args:
#   - APP_NAME: Name of the app (e.g., app, web-admin) - determines the path
# =============================================================================

FROM node:22-alpine

# Build argument for app name (used for proper path resolution)
# Must be declared before using it in COPY commands
ARG APP_NAME=app

WORKDIR /app

ENV NODE_ENV=production
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets if they exist
COPY --chown=nextjs:nodejs public ./public

# Copy standalone build output
COPY --chown=nextjs:nodejs .next/standalone ./

# Copy static files to the correct location relative to server.js
# Since standalone output places server.js in apps/<app>/server.js,
# static files should be at apps/<app>/.next/static
COPY --chown=nextjs:nodejs .next/static ./apps/${APP_NAME}/.next/static

# Copy public to the app-specific location as well (for basePath routing)
COPY --chown=nextjs:nodejs public ./apps/${APP_NAME}/public

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Change to the app directory and run server
WORKDIR /app/apps/${APP_NAME}

CMD ["node", "server.js"]

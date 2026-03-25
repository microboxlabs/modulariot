# =============================================================================
# Next.js Standalone Production Image - Documentation Site
# =============================================================================
# This Dockerfile is specifically for the docs application.
# It expects the build artifacts to be pre-built and copied into the context.
#
# Build context should contain:
#   - .next/standalone/ - The standalone build output
#   - .next/static/     - Static files
#   - public/           - Public assets (optional)
# =============================================================================

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets if they exist (docs may not have many public assets)
COPY --chown=nextjs:nodejs public ./public

# Copy standalone build output
COPY --chown=nextjs:nodejs .next/standalone ./

# Copy static files to the correct location relative to server.js
# Since server.js is at apps/docs/server.js, static files should be at apps/docs/.next/static
COPY --chown=nextjs:nodejs .next/static ./apps/docs/.next/static

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run the server from the directory containing server.js
# This ensures proper path resolution for static files and modules
WORKDIR /app/apps/docs

CMD ["node", "server.js"]

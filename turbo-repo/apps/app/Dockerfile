# Production image, copy all the files and run next
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY public ./public

# Copy source code for source map debugging (needed for source maps to resolve)
COPY --chown=root:root --chmod=755 src ./src

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --chown=root:root --chmod=755 .next/standalone ./
COPY --chown=root:root --chmod=755 .next/static ./.next/static

# Copy server-side source maps for server-side debugging
# Note: Source maps (.map files) are already in .next/static for client-side
COPY --chown=root:root  --chmod=755 .next/server ./.next/server

# Remove write permissions from all files for security
RUN chmod -R a-w /app

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
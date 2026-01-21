# Production image, copy all the files and run next
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV production
# Build argument for server path
ARG SERVER_PATH=server.js
ENV SERVER_PATH=${SERVER_PATH}
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# COPY public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --chown=nextjs:nodejs .next/standalone ./
# Copy static files to the correct location relative to server.js
# Since server.js is at apps/docs/server.js, static files should be at apps/docs/.next/static
COPY --chown=nextjs:nodejs .next/static ./apps/docs/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME 0.0.0.0

# Run the server from the directory containing server.js
# This ensures proper path resolution for static files and modules
WORKDIR /app/apps/docs

CMD sh -c "node server.js"
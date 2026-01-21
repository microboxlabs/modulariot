# Production image, copy all the files and run next
FROM oven/bun:1-debian
WORKDIR /app

# Build argument for server path
ARG SERVER_PATH=server.js
ENV SERVER_PATH=${SERVER_PATH}

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

# Install necessary packages
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

COPY public ./public

# Copy Prisma schema first
# COPY --chown=nextjs:nodejs prisma ./prisma/

# Copy package.json from the web app
COPY --chown=nextjs:nodejs package.json ./

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./apps/docs/.next/static

USER root

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME 0.0.0.0

CMD sh -c "node ${SERVER_PATH}"
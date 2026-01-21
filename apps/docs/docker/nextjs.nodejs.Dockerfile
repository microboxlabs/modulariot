# Production image, copy all the files and run next
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

# Install necessary packages
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# Copy Prisma schema first
# COPY --chown=nextjs:nodejs prisma ./prisma/

# Copy package.json from the web app
COPY --chown=nextjs:nodejs package.json ./

COPY public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME 0.0.0.0

# Build argument for server path (for compatibility with existing setup)
ARG SERVER_PATH=server.js
ENV SERVER_PATH=${SERVER_PATH}

CMD sh -c "node ${SERVER_PATH}"
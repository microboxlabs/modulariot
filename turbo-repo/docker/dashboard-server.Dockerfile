# @microboxlabs/miot-dashboard-server — standalone image.
#
# The context is assembled by .github/workflows/dashboard-server.yml: dist/,
# examples/, node_modules/ and a `{"type": "module"}` package.json.
#
# Runtime packages: @microboxlabs/miot-dashboard-contract and zod (the config
# schema and the OpenAPI document), jose (verifies bearer tokens),
# swagger-ui-dist (optional; without it /docs explains how to add it). The
# store is node:sqlite, which ships with Node.

FROM node:24-alpine

WORKDIR /app

# Refuses MIOT_DASHBOARD_INSECURE_AUTH, which trusts request headers.
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 dashboards

COPY --chown=dashboards:nodejs package.json ./
COPY --chown=dashboards:nodejs node_modules ./node_modules
COPY --chown=dashboards:nodejs dist ./dist
COPY --chown=dashboards:nodejs examples ./examples

# Mount a volume here for dashboards to outlive the container.
RUN mkdir -p /data/documents && chown -R dashboards:nodejs /data
VOLUME ["/data"]

USER dashboards

EXPOSE 3070

ENV PORT=3070
# The package defaults to 127.0.0.1, which answers nobody in a container.
ENV HOST=0.0.0.0
ENV MIOT_DASHBOARD_SQLITE_PATH=/data/dashboards.db
ENV MIOT_DASHBOARD_DOCUMENTS_PATH=/data/documents

CMD ["node", "dist/bin.js"]

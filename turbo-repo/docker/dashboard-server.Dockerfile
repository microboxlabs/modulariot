# =============================================================================
# @microboxlabs/miot-dashboard-server — standalone image
# =============================================================================
# Expects a pre-built context, assembled by .github/workflows/dashboard-server.yml:
#
#   dist/          tsup output, including the bin.js this runs
#   examples/      the seed MIOT_DASHBOARD_SEED=example resolves
#   contract/      the OpenAPI document /openapi.yaml serves
#   node_modules/  jose and swagger-ui-dist, copied from the monorepo install
#   package.json   `{"type": "module"}`, so dist/*.js loads as ESM
#
# The two runtime packages are copied rather than installed here: they are
# optional peers, so the lockfile of the monorepo that built dist/ is the only
# place their versions are resolved, and a second `npm install` could pick
# different ones than the build was checked against.
#
#   jose            required — verifies bearer tokens, the only identity
#                   provider a non-loopback bind will accept
#   swagger-ui-dist optional — renders /docs; without it that path explains
#                   how to add it and nothing else changes
#
# The store is node:sqlite, which is part of Node, so nothing is installed for
# persistence either.
# =============================================================================

FROM node:24-alpine

WORKDIR /app

# Refuses MIOT_DASHBOARD_INSECURE_AUTH, which reads identity from request
# headers without verifying it. The bind address below refuses it again.
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 dashboards

COPY --chown=dashboards:nodejs package.json ./
COPY --chown=dashboards:nodejs node_modules ./node_modules
COPY --chown=dashboards:nodejs dist ./dist
COPY --chown=dashboards:nodejs examples ./examples
COPY --chown=dashboards:nodejs contract ./contract

# Where the sqlite file and the config documents go. A deployment that wants
# dashboards to outlive the pod mounts a volume here; without one they live in
# the container's writable layer and go with it.
RUN mkdir -p /data/documents && chown -R dashboards:nodejs /data
VOLUME ["/data"]

USER dashboards

EXPOSE 3070

ENV PORT=3070
# The package defaults to 127.0.0.1, which inside a container answers nobody.
# Binding past loopback is also what makes the server refuse unverified header
# identity, so an image that listens is an image that verifies.
ENV HOST=0.0.0.0
ENV MIOT_DASHBOARD_SQLITE_PATH=/data/dashboards.db
ENV MIOT_DASHBOARD_DOCUMENTS_PATH=/data/documents

CMD ["node", "dist/bin.js"]

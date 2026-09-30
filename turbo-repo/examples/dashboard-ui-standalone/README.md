# Standalone embedded billing dashboard

[Español](README.es.md)

A runnable browser host for the dashboard UI library: no host React, Next.js,
Alfresco or Java. It demonstrates actual server saved queries, service selection,
refresh and three embedded widgets. The shell, summary and searchable table are
host code; they do not represent a completed portable table/editor catalog.

## Run

Requires Node 22+, a dashboard server with the billing saved query, and a built
or unpacked UI package containing the text, percentage and circular registries.
The example currently uses candidate APIs; it does not imply a published npm release.

1. Build `@microboxlabs/miot-dashboard-ui` in the monorepo, or unpack its candidate
   npm tarball into a private directory.
2. From this directory, run `UI_PACKAGE_DIR=../../packages/miot-dashboard-ui npm run prepare:ui`.
   An installed package directory can also be supplied. Generated assets are ignored.
3. Copy `.env.example` to `.env` and set the server URL and private file paths.
   The signing key must be trusted by that server. Use a **Consumer** subject with
   permission to read the configured tenant/scope/dashboard and execute its query.
4. Generate separate random access/session values outside source control:
   `openssl rand -base64 32 > /private/path/access-password` and
   `openssl rand -base64 48 > /private/path/session-secret`; restrict permissions to 0600.
5. Run `node --env-file=.env server.mjs` and open
   `http://127.0.0.1:14004/dashboard-demo/`. Sign in using the access-code file.

The saved query must return `service` and numeric `net_cost` fields and be declared
with variable name `costs`. The example labels its data as the last 30 days in USD;
configure the server operation accordingly or change the host labels. Its fixed
proxy submits empty filters only. Selection, aggregation and search happen over
the authorized result in the host; users cannot supply arbitrary SQL, paths or credentials.

## Embedding boundary

`public/demo.js` imports factories and `mountDashboard` from the same self-contained
runtime. It supplies a registry, widgets and a saved-query transport. A different
framework can supply the same options. Updating selection calls `update`; page
teardown calls `destroy`. The included examples preserve a read-only Consumer flow.

A Node proxy signs short-lived server JWTs; no signing key, service-account key or
database credential is sent to the browser. HTTPS enables Secure session cookies.
Set `PUBLIC_ORIGIN` to the exact external origin and `BASE_PATH` to the routed prefix.
Deploy behind an HTTPS ingress; keep the upstream server private. Health is exposed
at `/healthz`. Persistent secret files must be mounted read-only.

## Limits

This is a private demonstration access gate, not production SSO. Its expiring
HttpOnly/SameSite cookies and access code are separate from the dashboard server's
Consumer authorization. The Handlebars compiler currently requires `unsafe-eval`
in script CSP. The host CSS is intentionally scoped to this example. No dashboard
editing or permissions administration is exposed. Never commit `.env`, key files,
access codes or session secrets.

### Ingress and validation

For direct access leave `TRUSTED_PROXY_IPS` empty: forwarded headers are ignored.
Behind an ingress, set it to the exact comma-separated IP addresses of the immediate
proxy peers, and configure those proxies to overwrite `X-Real-IP` with the real
client address. Never trust a client-supplied header or an entire network by default.
Update the allowlist when proxy pods change. A missing/invalid header falls back
to the socket peer, which can share a throttle bucket; configure a trusted ingress
before exposing the demo. The in-process limiter is bounded to 2,048 identities,
expires failed-login buckets after ten minutes and is per replica. Use a shared
or ingress limiter if deploying multiple replicas.

Run `npm test` for repeatable local HTTP authentication/origin/cookie/route tests,
proxy trust, bounded throttling and duplicate-service aggregation. Tests generate
temporary keys and use a local fake upstream; the billing integration still needs
a configured real dashboard server. Billing rows are aggregated by service before
calculating totals, service counts and shares.

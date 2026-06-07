# @microboxlabs/miot-auth

Shared browser-login helpers for the miot CLI family ([`miot-chat`](../miot-chat), [`miot-cli`](../miot-cli)). Lives at `turbo-repo/packages/miot-auth`.

This is a leaf library — no runtime dependencies, no bin. It exists so both CLIs can share one login implementation without depending on each other.

## Install

```bash
npm install @microboxlabs/miot-auth
```

## Usage

The package exposes subpath exports only (no root export):

```ts
import { browserLogin } from "@microboxlabs/miot-auth/browser-oauth";

const result = await browserLogin({
  baseUrl: "https://<platform-host>",
  // optional overrides; defaults are derived from baseUrl:
  //   loginUrl  -> {baseUrl}/app/cli/auth/login
  //   tokenUrl  -> {baseUrl}/app/api/cli/auth/token
  // or pass clientId/authorizationUrl/audience/scope for direct OAuth PKCE.
});

result.accessToken;     // bearer token for the platform API
result.organizationId;  // active organization slug (platform handoff mode)
```

`browserLogin` starts a loopback HTTP server, opens the browser at the platform's CLI login handoff (or an OAuth authorization endpoint when `clientId` is set), and resolves when the redirect lands back on the loopback with a code that it exchanges at the token endpoint. Persistence is the caller's job — this library never touches config files.

Environment overrides honored at call time: `MIOT_LOGIN_URL`, `MIOT_OAUTH_CLIENT_ID`, `MIOT_OAUTH_AUTHORIZE_URL`, `MIOT_OAUTH_TOKEN_URL`, `MIOT_OAUTH_AUDIENCE`, `MIOT_OAUTH_SCOPE`.

## Develop

```bash
npm run build         # tsup
npm test              # vitest
npm run lint
npm run check-types
```

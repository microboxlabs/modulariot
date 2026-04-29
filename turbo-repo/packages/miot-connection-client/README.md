# @microboxlabs/miot-connection-client

TypeScript client for the ModularIoT integration connections API.

```ts
import { createMiotConnectionClient } from "@microboxlabs/miot-connection-client";

const client = createMiotConnectionClient({
  baseUrl: "https://api.example.com",
  organizationId: "org-1",
  headers: { Authorization: `Bearer ${token}` },
});

const profile = await client.credentialProfiles.create({
  displayName: "PostgREST token",
  authType: "BEARER_TOKEN",
  secretConfig: { token: "secret-token" },
});

const connection = await client.connections.create({
  name: "Fleet PostgREST",
  providerType: "POSTGREST",
  baseUrl: "https://postgrest.example.com",
  credentialProfileId: profile.id,
});

await client.connections.createOperation(connection.id, {
  name: "List trucks",
  method: "GET",
  path: "/trucks",
  testOperation: true,
});
```

## API

- `credentialProfiles.list()`
- `credentialProfiles.create(body)`
- `connections.list()`
- `connections.get(connectionId)`
- `connections.create(body)`
- `connections.test(connectionId, body?)`
- `connections.listOperations(connectionId)`
- `connections.createOperation(connectionId, body)`

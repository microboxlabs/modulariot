import { describe, expect, it } from "vitest";
import { createMiotConnectionClient } from "../index.js";
import type { CredentialProfileResponse } from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const ORG_ID = "org-1";
const CREDENTIAL_PROFILES = `/api/v1/orgs/${ORG_ID}/integrations/credential-profiles`;

const sampleProfile: CredentialProfileResponse = {
  id: "profile-1",
  tenantCode: "tenant-1",
  displayName: "Bearer credentials",
  authType: "BEARER_TOKEN",
  publicConfig: {},
  secretPreview: "****",
  secretVersion: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("credentialProfiles", () => {
  it("list sends GET to /credential-profiles", async () => {
    const { fn, call } = createMockFetch([sampleProfile]);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });

    const result = await client.credentialProfiles.list();

    expect(call.init.method).toBe("GET");
    expect(call.url).toBe(`${BASE_URL}${CREDENTIAL_PROFILES}`);
    expect(result).toEqual([sampleProfile]);
  });

  it("create sends POST with body", async () => {
    const { fn, call } = createMockFetch(sampleProfile);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });
    const body = {
      displayName: "Bearer credentials",
      authType: "BEARER_TOKEN" as const,
      secretConfig: { token: "token-123" },
    };

    await client.credentialProfiles.create(body);

    expect(call.init.method).toBe("POST");
    expect(call.url).toBe(`${BASE_URL}${CREDENTIAL_PROFILES}`);
    expect(call.init.body).toBe(JSON.stringify(body));
  });
});

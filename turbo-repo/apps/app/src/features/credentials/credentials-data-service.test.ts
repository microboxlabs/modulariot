import { afterEach, describe, expect, it, vi } from "vitest";
import type { Auth0M2MFormData, AzureEntraFormData } from "./credential.types";
import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  testCredential,
  updateCredential,
} from "./credentials-data-service";

const ORG = "acme";

const FORM: AzureEntraFormData = {
  name: "Partner API",
  environment: "QA",
  tenantId: "11111111-2222-3333-4444-555555555555",
  clientId: "66666666-7777-8888-9999-000000000000",
  clientSecret: "s3cret",
  scope: "api://partner-api/.default",
  tokenRequestFormat: "FORM",
  tokenUrlOverride: "",
};

const AUTH0_FORM: Auth0M2MFormData = {
  name: "Auth0 API",
  environment: "QA",
  domain: "  tenant.auth0.com  ",
  clientId: "client-id",
  clientSecret: "s3cret",
  audience: "https://api.example.com",
  scope: "",
  tokenRequestFormat: "FORM",
  tokenUrlOverride: "",
};

function apiCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    displayName: "Partner API",
    credentialType: "AZURE_ENTRA_CLIENT_CREDENTIALS",
    environment: "QA",
    publicConfig: {
      tenantId: "11111111-2222-3333-4444-555555555555",
      clientId: "66666666-7777-8888-9999-000000000000",
      scope: "api://partner-api/.default",
      tokenRequestFormat: "FORM",
    },
    summary: "66666666-7777-8888-9999-000000000000",
    secretPreview: "****",
    secretVersion: 1,
    lastTestedAt: null,
    lastTestResult: null,
    usedBy: [],
    createdAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-02T10:00:00Z",
    createdBy: "owner@microboxlabs.com",
    updatedBy: null,
    ...overrides,
  };
}

/** Captures the request so assertions can read the URL, verb and body. */
function stubFetch(response: { status?: number; body?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: (response.status ?? 200) < 400,
    status: response.status ?? 200,
    json: async () => response.body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("credentials data service", () => {
  it("renames the backend's display name to the name the screen shows", async () => {
    stubFetch({ body: [apiCredential()] });

    const [credential] = await fetchCredentials(ORG);

    expect(credential.name).toBe("Partner API");
    expect(credential.typeId).toBe("AZURE_ENTRA_CLIENT_CREDENTIALS");
    expect(credential.config).toMatchObject({ clientId: FORM.clientId });
  });

  // An untested credential must read as untested, not as failed: `lastTestResult:
  // null` is "no answer yet", and `false` would paint a red badge.
  it("leaves the test result absent when nothing has been tested", async () => {
    stubFetch({ body: [apiCredential()] });

    const [credential] = await fetchCredentials(ORG);

    expect(credential.lastTestResult).toBeUndefined();
    expect(credential.lastTestedAt).toBeUndefined();
  });

  it("falls back to the creator when nobody has edited the credential yet", async () => {
    stubFetch({ body: [apiCredential()] });

    const [credential] = await fetchCredentials(ORG);

    expect(credential.updatedBy).toBe("owner@microboxlabs.com");
  });

  it("sends the client secret when creating", async () => {
    const fetchMock = stubFetch({ body: apiCredential() });

    await createCredential(ORG, "AZURE_ENTRA_CLIENT_CREDENTIALS", FORM);

    expect(bodyOf(fetchMock)).toMatchObject({
      displayName: "Partner API",
      credentialType: "AZURE_ENTRA_CLIENT_CREDENTIALS",
      environment: "QA",
      secretConfig: { clientSecret: "s3cret" },
    });
  });

  // A blank override would otherwise replace the endpoint derived from the directory id.
  it("omits an empty token URL override", async () => {
    const fetchMock = stubFetch({ body: apiCredential() });

    await createCredential(ORG, "AZURE_ENTRA_CLIENT_CREDENTIALS", FORM);

    const publicConfig = bodyOf(fetchMock).publicConfig as Record<
      string,
      string
    >;
    expect(publicConfig).not.toHaveProperty("tokenUrlOverride");
  });

  it("persists a normalized Auth0 domain and derived token URL", async () => {
    const fetchMock = stubFetch({ body: apiCredential() });

    await createCredential(ORG, "AUTH0_M2M", AUTH0_FORM);

    expect(bodyOf(fetchMock)).toMatchObject({
      credentialType: "OAUTH2_CLIENT_CREDENTIALS",
      publicConfig: {
        domain: "tenant.auth0.com",
        tokenUrl: "https://tenant.auth0.com/oauth/token",
      },
    });
  });

  /**
   * The edit form cannot show a stored secret, so it submits an empty one. Sending that
   * through would overwrite a working credential with nothing.
   */
  it("sends no secret on edit when the field was left blank", async () => {
    const fetchMock = stubFetch({ body: apiCredential() });

    await updateCredential(ORG, "cred-1", { ...FORM, clientSecret: "" });

    expect(bodyOf(fetchMock)).not.toHaveProperty("secretConfig");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  });

  it("sends the secret on edit once a new one is typed", async () => {
    const fetchMock = stubFetch({ body: apiCredential() });

    await updateCredential(ORG, "cred-1", { ...FORM, clientSecret: "rotated" });

    expect(bodyOf(fetchMock)).toMatchObject({
      secretConfig: { clientSecret: "rotated" },
    });
  });

  it("asks to delete a referenced credential only when told to force it", async () => {
    const forced = stubFetch({ status: 204 });
    await deleteCredential(ORG, "cred-1", true);
    expect(forced.mock.calls[0][0]).toContain("?force=true");

    vi.unstubAllGlobals();
    const plain = stubFetch({ status: 204 });
    await deleteCredential(ORG, "cred-1", false);
    expect(plain.mock.calls[0][0]).not.toContain("force");
  });

  it("repeats the API's own reason so a rejection names the field", async () => {
    stubFetch({ status: 400, body: { error: "tenantId is required" } });

    await expect(
      createCredential(ORG, "AZURE_ENTRA_CLIENT_CREDENTIALS", FORM)
    ).rejects.toThrow("tenantId is required");
  });

  it("carries the 403 status through so the page can explain it", async () => {
    stubFetch({
      status: 403,
      body: { error: "Organization owner access required" },
    });

    await expect(fetchCredentials(ORG)).rejects.toMatchObject({ status: 403 });
  });

  it("reports the token lifetime a successful test returned", async () => {
    stubFetch({
      body: { success: true, message: "Token issued", expiresInSeconds: 3599 },
    });

    await expect(testCredential(ORG, "cred-1")).resolves.toEqual({
      success: true,
      message: "Token issued",
      expiresInSeconds: 3599,
    });
  });
});

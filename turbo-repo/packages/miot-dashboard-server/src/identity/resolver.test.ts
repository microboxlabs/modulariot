import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  generateTestKeyPair,
  signRs256,
  validClaims,
  type TestKeyPair,
} from "../test/tokens";
import type { KeyRing } from "./jwt";
import { createJwtIdentityResolver } from "./resolver";

let pair: TestKeyPair;

beforeAll(async () => {
  pair = await generateTestKeyPair("test-key");
});

const TENANT_CLAIM = "https://miot.dev/tenant_id";

function resolverFor(
  overrides: Partial<Parameters<typeof createJwtIdentityResolver>[0]> = {},
) {
  return createJwtIdentityResolver({
    issuer: "https://issuer.test/",
    audience: "miot-dashboards",
    algorithm: "RS256",
    keys: pair.publicKey,
    claims: {},
    ...overrides,
  });
}

function requestWith(
  token: string | null,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://server.test/api/dashboards/site/report", {
    headers: {
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      ...headers,
    },
  });
}

const tokenFor = (claims: Record<string, unknown>): Promise<string> =>
  signRs256(pair.privateKey, { claims: validClaims(claims) });

describe("createJwtIdentityResolver", () => {
  it("reads the identity out of a verified token", async () => {
    const token = await tokenFor({
      sub: "auth0|alice",
      name: "Alice",
      [TENANT_CLAIM]: "tenant-a",
      groups: ["GROUP_finance", "GROUP_ops"],
    });

    await expect(
      resolverFor({
        claims: { groups: "groups" },
      }).resolve(requestWith(token)),
    ).resolves.toEqual({
      userId: "auth0|alice",
      kind: "user",
      displayName: "Alice",
      groups: ["GROUP_finance", "GROUP_ops"],
      capabilities: {
        readOnly: false,
        canEdit: true,
        canShare: true,
        canManagePermissions: true,
        canDelete: true,
      },
    });
  });

  it("produces no tenant, whatever the token carries", async () => {
    // The tenant is a property of the request, checked by the TenantAuthority.
    // A resolver that reported one here would bind the credential to it and
    // put the choice back where a caller with two tenants cannot use it.
    const principal = await resolverFor().resolve(
      requestWith(await tokenFor({ [TENANT_CLAIM]: "tenant-a" })),
    );
    expect(principal).not.toBeNull();
    expect(principal).not.toHaveProperty("tenantId");
  });

  it("has no identity for a request that presents no credential", async () => {
    const onReject = vi.fn();
    await expect(
      resolverFor({ onReject }).resolve(requestWith(null)),
    ).resolves.toBeNull();
    // An anonymous request is not a refusal; logging it would record every
    // unauthenticated request.
    expect(onReject).not.toHaveBeenCalled();
  });

  it.each([
    ["a scheme that is not Bearer", "Basic dXNlcjpwYXNz"],
    ["a bearer with nothing after it", "Bearer"],
    ["a header that is only the token", "eyJhbGciOiJSUzI1NiJ9.e30.x"],
  ])("has no identity for %s", async (_name, header) => {
    await expect(
      resolverFor().resolve(requestWith(null, { authorization: header })),
    ).resolves.toBeNull();
  });

  it("tolerates extra spacing in the Authorization header", async () => {
    const token = await tokenFor({ sub: "auth0|alice" });
    await expect(
      resolverFor().resolve(
        requestWith(null, { authorization: `  bearer   ${token}  ` }),
      ),
    ).resolves.toMatchObject({ userId: "auth0|alice" });
  });

  it("refuses a token it cannot verify, and says why in the log only", async () => {
    const onReject = vi.fn();
    const token = await signRs256(pair.privateKey, {
      claims: validClaims({ aud: "another-api", [TENANT_CLAIM]: "tenant-a" }),
    });

    await expect(
      resolverFor({ onReject }).resolve(requestWith(token)),
    ).resolves.toBeNull();
    // The wording is jose's. What matters is that the reason names the claim
    // that failed and goes to the log rather than to the caller.
    expect(onReject).toHaveBeenCalledWith(expect.stringMatching(/aud/));
  });

  it("accepts a verified token that carries no tenant claim", async () => {
    // Nothing reads one any more, so a token without it is a normal token.
    const onReject = vi.fn();
    await expect(
      resolverFor({ onReject }).resolve(
        requestWith(await tokenFor({ sub: "auth0|alice" })),
      ),
    ).resolves.toMatchObject({ userId: "auth0|alice" });
    expect(onReject).not.toHaveBeenCalled();
  });

  it("lets a key source failure through instead of answering 401", async () => {
    const broken: KeyRing = () =>
      Promise.reject(new Error("JWKS endpoint is down"));
    const token = await tokenFor({ [TENANT_CLAIM]: "tenant-a" });

    await expect(
      resolverFor({ keys: broken }).resolve(requestWith(token)),
    ).rejects.toThrow("JWKS endpoint is down");
  });

  describe("principal kind", () => {
    it("calls an Auth0 machine-to-machine token a service", async () => {
      const token = await tokenFor({
        [TENANT_CLAIM]: "tenant-a",
        gty: "client-credentials",
      });
      await expect(
        resolverFor().resolve(requestWith(token)),
      ).resolves.toMatchObject({ kind: "service" });
    });

    it("recognises the @clients subject Auth0 gives those tokens", async () => {
      const token = await tokenFor({
        sub: "abc123@clients",
        [TENANT_CLAIM]: "tenant-a",
      });
      await expect(
        resolverFor().resolve(requestWith(token)),
      ).resolves.toMatchObject({ kind: "service" });
    });

    it("can be told apart differently by the host", async () => {
      const token = await tokenFor({ [TENANT_CLAIM]: "tenant-a" });
      await expect(
        resolverFor({ principalKind: () => "service" }).resolve(
          requestWith(token),
        ),
      ).resolves.toMatchObject({ kind: "service" });
    });
  });

  describe("groups", () => {
    it("reads a space-separated string, as a scope claim is written", async () => {
      const token = await tokenFor({
        [TENANT_CLAIM]: "tenant-a",
        scope: "GROUP_finance GROUP_ops",
      });
      await expect(
        resolverFor({
          claims: { groups: "scope" },
        }).resolve(requestWith(token)),
      ).resolves.toMatchObject({ groups: ["GROUP_finance", "GROUP_ops"] });
    });

    it("leaves the field off when the claim is not configured", async () => {
      const token = await tokenFor({
        [TENANT_CLAIM]: "tenant-a",
        groups: ["GROUP_finance"],
      });
      const identity = await resolverFor().resolve(requestWith(token));
      expect(identity).not.toHaveProperty("groups");
    });

    it("drops entries that are not strings", async () => {
      const token = await tokenFor({
        [TENANT_CLAIM]: "tenant-a",
        groups: ["GROUP_finance", 7, null, "  ", "GROUP_ops"],
      });
      await expect(
        resolverFor({
          claims: { groups: "groups" },
        }).resolve(requestWith(token)),
      ).resolves.toMatchObject({ groups: ["GROUP_finance", "GROUP_ops"] });
    });
  });

  describe("configuration", () => {
    it("refuses to be built without an audience", () => {
      // Without one, any token this issuer signed for any of its APIs would
      // be accepted here.
      expect(() => resolverFor({ audience: [] })).toThrow(/audience/);
    });
  });
});

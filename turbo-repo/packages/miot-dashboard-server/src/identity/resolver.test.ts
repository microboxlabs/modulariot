import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  generateTestKeyPair,
  signRs256,
  validClaims,
  type TestKeyPair,
} from "../test/tokens";
import type { KeyRing } from "./jwt";
import { createStaticKeyRing } from "./keys";
import { createJwtIdentityResolver } from "./resolver";

let pair: TestKeyPair;

beforeAll(() => {
  pair = generateTestKeyPair("test-key");
});

const TENANT_CLAIM = "https://miot.dev/tenant_id";

function resolverFor(
  overrides: Partial<Parameters<typeof createJwtIdentityResolver>[0]> = {},
) {
  return createJwtIdentityResolver({
    issuer: "https://issuer.test/",
    audience: "miot-dashboards",
    algorithm: "RS256",
    keys: createStaticKeyRing(pair.publicKey),
    claims: { tenantId: TENANT_CLAIM },
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

const tokenFor = (claims: Record<string, unknown>): string =>
  signRs256(pair.privateKey, { claims: validClaims(claims) });

describe("createJwtIdentityResolver", () => {
  it("reads the identity out of a verified token", async () => {
    const token = tokenFor({
      sub: "auth0|alice",
      name: "Alice",
      [TENANT_CLAIM]: "tenant-a",
      groups: ["GROUP_finance", "GROUP_ops"],
    });

    await expect(
      resolverFor({
        claims: { tenantId: TENANT_CLAIM, groups: "groups" },
      }).resolve(requestWith(token)),
    ).resolves.toEqual({
      userId: "auth0|alice",
      tenantId: "tenant-a",
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

  it("takes the tenant from the token and ignores anything the request says", async () => {
    // The invariant the whole package rests on: a caller can name any tenant
    // they like in a header, a path or a body and it changes nothing.
    const token = tokenFor({ [TENANT_CLAIM]: "tenant-a" });
    const identity = await resolverFor().resolve(
      requestWith(token, {
        "x-dev-tenant": "tenant-b",
        "x-tenant-id": "tenant-b",
      }),
    );
    expect(identity?.tenantId).toBe("tenant-a");
  });

  it("has no identity for a request that presents no credential", async () => {
    const onReject = vi.fn();
    await expect(
      resolverFor({ onReject }).resolve(requestWith(null)),
    ).resolves.toBeNull();
    // An anonymous request is not a refusal worth logging; every
    // unauthenticated probe would land in the log.
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
    const token = tokenFor({ [TENANT_CLAIM]: "tenant-a" });
    await expect(
      resolverFor().resolve(
        requestWith(null, { authorization: `  bearer   ${token}  ` }),
      ),
    ).resolves.toMatchObject({ tenantId: "tenant-a" });
  });

  it("refuses a token it cannot verify, and says why in the log only", async () => {
    const onReject = vi.fn();
    const token = signRs256(pair.privateKey, {
      claims: validClaims({ aud: "another-api", [TENANT_CLAIM]: "tenant-a" }),
    });

    await expect(
      resolverFor({ onReject }).resolve(requestWith(token)),
    ).resolves.toBeNull();
    expect(onReject).toHaveBeenCalledWith(expect.stringMatching(/audience/));
  });

  it("refuses a verified token that carries no tenant", async () => {
    const onReject = vi.fn();
    const token = tokenFor({ sub: "auth0|alice" });

    await expect(
      resolverFor({ onReject }).resolve(requestWith(token)),
    ).resolves.toBeNull();
    expect(onReject).toHaveBeenCalledWith(
      expect.stringContaining(TENANT_CLAIM),
    );
  });

  it("does not fall back to a header when the token has no tenant", async () => {
    // The dangerous shape of the previous case: a missing claim is where a
    // convenience fallback gets added, and it would hand the caller a tenant
    // they chose. Refusing the request is the only correct answer.
    const token = tokenFor({ sub: "auth0|alice" });
    await expect(
      resolverFor().resolve(
        requestWith(token, {
          "x-dev-tenant": "tenant-a",
          "x-tenant-id": "tenant-a",
        }),
      ),
    ).resolves.toBeNull();
  });

  it("accepts a numeric tenant claim", async () => {
    const token = tokenFor({ [TENANT_CLAIM]: 42 });
    await expect(
      resolverFor().resolve(requestWith(token)),
    ).resolves.toMatchObject({ tenantId: "42" });
  });

  it("lets a key source failure through instead of answering 401", async () => {
    const broken: KeyRing = {
      resolve: () => Promise.reject(new Error("JWKS endpoint is down")),
    };
    const token = tokenFor({ [TENANT_CLAIM]: "tenant-a" });

    await expect(
      resolverFor({ keys: broken }).resolve(requestWith(token)),
    ).rejects.toThrow("JWKS endpoint is down");
  });

  describe("principal kind", () => {
    it("calls an Auth0 machine-to-machine token a service", async () => {
      const token = tokenFor({
        [TENANT_CLAIM]: "tenant-a",
        gty: "client-credentials",
      });
      await expect(
        resolverFor().resolve(requestWith(token)),
      ).resolves.toMatchObject({ kind: "service" });
    });

    it("recognises the @clients subject Auth0 gives those tokens", async () => {
      const token = tokenFor({
        sub: "abc123@clients",
        [TENANT_CLAIM]: "tenant-a",
      });
      await expect(
        resolverFor().resolve(requestWith(token)),
      ).resolves.toMatchObject({ kind: "service" });
    });

    it("can be told apart differently by the host", async () => {
      const token = tokenFor({ [TENANT_CLAIM]: "tenant-a" });
      await expect(
        resolverFor({ principalKind: () => "service" }).resolve(
          requestWith(token),
        ),
      ).resolves.toMatchObject({ kind: "service" });
    });
  });

  describe("groups", () => {
    it("reads a space-separated string, as a scope claim is written", async () => {
      const token = tokenFor({
        [TENANT_CLAIM]: "tenant-a",
        scope: "GROUP_finance GROUP_ops",
      });
      await expect(
        resolverFor({
          claims: { tenantId: TENANT_CLAIM, groups: "scope" },
        }).resolve(requestWith(token)),
      ).resolves.toMatchObject({ groups: ["GROUP_finance", "GROUP_ops"] });
    });

    it("leaves the field off when the claim is not configured", async () => {
      const token = tokenFor({
        [TENANT_CLAIM]: "tenant-a",
        groups: ["GROUP_finance"],
      });
      const identity = await resolverFor().resolve(requestWith(token));
      expect(identity).not.toHaveProperty("groups");
    });

    it("drops entries that are not strings", async () => {
      const token = tokenFor({
        [TENANT_CLAIM]: "tenant-a",
        groups: ["GROUP_finance", 7, null, "  ", "GROUP_ops"],
      });
      await expect(
        resolverFor({
          claims: { tenantId: TENANT_CLAIM, groups: "groups" },
        }).resolve(requestWith(token)),
      ).resolves.toMatchObject({ groups: ["GROUP_finance", "GROUP_ops"] });
    });
  });

  describe("configuration", () => {
    it("refuses to be built without an audience", () => {
      // Without one, every token this issuer signed for any of its APIs
      // would be accepted here.
      expect(() => resolverFor({ audience: [] })).toThrow(/audience/);
    });

    it("refuses to be built without a tenant claim", () => {
      expect(() => resolverFor({ claims: { tenantId: "" } })).toThrow(
        /tenant claim/,
      );
    });
  });
});

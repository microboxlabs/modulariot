import { describe, expect, it, vi } from "vitest";
import { FULL_CAPABILITIES } from "../access/roles";
import type { DashboardPrincipal, IdentityResolver } from "../seams/identity";
import {
  createTrustedProxyIdentityResolver,
  ProxyAssertionError,
} from "./proxy";

const KEY = "0123456789abcdef0123456789abcdef";

const ana: DashboardPrincipal = {
  userId: "ana@example.test",
  kind: "user",
  capabilities: { ...FULL_CAPABILITIES },
};

const verifying = (principal: DashboardPrincipal | null = ana) =>
  ({
    resolve: vi.fn(() => Promise.resolve(principal)),
  }) satisfies IdentityResolver<Request>;

const resolver = (inner: IdentityResolver<Request> = verifying()) =>
  createTrustedProxyIdentityResolver({ key: KEY, inner });

const asserting = (
  overrides: Record<string, string | null> = {},
): Request => {
  const headers: Record<string, string> = {
    "x-miot-proxy-key": KEY,
    "x-miot-asserted-user": ana.userId,
    "x-miot-asserted-tenant": "acme",
    "x-miot-asserted-scope": "ops",
    "x-miot-asserted-role": "Coordinator",
  };
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) delete headers[name];
    else headers[name] = value;
  }
  return new Request("https://server.test/", { headers });
};

describe("createTrustedProxyIdentityResolver", () => {
  it("refuses an empty key rather than accepting any header", () => {
    expect(() =>
      createTrustedProxyIdentityResolver({ key: "", inner: verifying() }),
    ).toThrow(TypeError);
  });

  it("delegates when no key header is present", async () => {
    const inner = verifying();
    const principal = await resolver(inner).resolve(
      new Request("https://server.test/"),
    );
    expect(principal).toMatchObject({ userId: ana.userId });
    expect(principal?.asserted).toBeUndefined();
    expect(inner.resolve).toHaveBeenCalledTimes(1);
  });

  it("passes an anonymous request through unchanged", async () => {
    await expect(
      resolver(verifying(null)).resolve(new Request("https://server.test/")),
    ).resolves.toBeNull();
  });

  it("attaches the assertion to the verified principal", async () => {
    const principal = await resolver().resolve(asserting());
    expect(principal).toMatchObject({
      userId: ana.userId,
      asserted: {
        tenantId: "acme",
        scopeId: "ops",
        role: "Coordinator",
      },
    });
  });

  it("throws on a wrong key rather than treating the caller as anonymous", async () => {
    await expect(
      resolver().resolve(asserting({ "x-miot-proxy-key": "wrong" })),
    ).rejects.toThrow(ProxyAssertionError);
  });

  it("throws on a key of the right length but the wrong value", async () => {
    const wrong = `${KEY.slice(0, -1)}X`;
    expect(wrong).toHaveLength(KEY.length);
    await expect(
      resolver().resolve(asserting({ "x-miot-proxy-key": wrong })),
    ).rejects.toThrow(ProxyAssertionError);
  });

  it("throws when the assertion names someone other than the token holder", async () => {
    await expect(
      resolver().resolve(
        asserting({ "x-miot-asserted-user": "bob@example.test" }),
      ),
    ).rejects.toThrow(/does not match the verified credential/);
  });

  it("throws when the bearer token is missing behind a valid key", async () => {
    await expect(
      resolver(verifying(null)).resolve(asserting()),
    ).rejects.toThrow(/no credential this server could verify/);
  });

  it("throws on a role the package does not define", async () => {
    await expect(
      resolver().resolve(asserting({ "x-miot-asserted-role": "SiteManager" })),
    ).rejects.toThrow(/is not a dashboard role/);
  });

  it.each([
    "x-miot-asserted-user",
    "x-miot-asserted-tenant",
    "x-miot-asserted-scope",
    "x-miot-asserted-role",
  ])("throws when %s is absent", async (header) => {
    await expect(resolver().resolve(asserting({ [header]: null }))).rejects.toThrow(
      ProxyAssertionError,
    );
  });

  it("throws on a header present but blank", async () => {
    await expect(
      resolver().resolve(asserting({ "x-miot-asserted-tenant": "   " })),
    ).rejects.toThrow(ProxyAssertionError);
  });

  it("reads the header names it was given", async () => {
    const inner = verifying();
    const custom = createTrustedProxyIdentityResolver({
      key: KEY,
      inner,
      headers: { key: "x-gateway-key", role: "x-gateway-role" },
    });
    const principal = await custom.resolve(
      new Request("https://server.test/", {
        headers: {
          "x-gateway-key": KEY,
          "x-gateway-role": "Editor",
          "x-miot-asserted-user": ana.userId,
          "x-miot-asserted-tenant": "acme",
          "x-miot-asserted-scope": "ops",
        },
      }),
    );
    expect(principal?.asserted?.role).toBe("Editor");
  });

  it("ignores the default key header when a different one is configured", async () => {
    const custom = createTrustedProxyIdentityResolver({
      key: KEY,
      inner: verifying(),
      headers: { key: "x-gateway-key" },
    });
    const principal = await custom.resolve(asserting());
    expect(principal?.asserted).toBeUndefined();
  });
});

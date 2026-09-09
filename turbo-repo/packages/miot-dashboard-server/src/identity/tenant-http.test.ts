import { describe, expect, it, vi } from "vitest";
import { FULL_CAPABILITIES } from "../access/roles";
import { EndpointError } from "../net/endpoint";
import type { DashboardPrincipal } from "../seams/identity";
import {
  createFixedTenantAuthority,
  createHttpTenantAuthority,
  type HttpTenantAuthorityOptions,
} from "./tenant-http";

const URL_TEMPLATE = "https://host.test/people/{userId}/tenants/{tenantId}";

const ana: DashboardPrincipal = {
  userId: "ana",
  kind: "user",
  capabilities: { ...FULL_CAPABILITIES },
  groups: ["engineering"],
};

function answering(
  status: number,
  body: unknown = {},
): { fetchImpl: typeof fetch; calls: Request[] } {
  const calls: Request[] = [];
  const fetchImpl = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push(new Request(input, init));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function authority(
  fetchImpl: typeof fetch,
  overrides: Partial<HttpTenantAuthorityOptions> = {},
) {
  return createHttpTenantAuthority({
    url: URL_TEMPLATE,
    fetchImpl,
    ...overrides,
  });
}

describe("createHttpTenantAuthority", () => {
  it("says yes when the host answers 200", async () => {
    const { fetchImpl, calls } = answering(200, { entitled: true });
    await expect(authority(fetchImpl).mayActAs(ana, "acme")).resolves.toBe(
      true,
    );
    expect(calls[0]?.url).toBe("https://host.test/people/ana/tenants/acme");
  });

  it("says no for the configured absent status", async () => {
    const { fetchImpl } = answering(404);
    await expect(authority(fetchImpl).mayActAs(ana, "acme")).resolves.toBe(
      false,
    );
  });

  it("url-encodes both ids, so neither can add a path segment", async () => {
    const { fetchImpl, calls } = answering(200);
    await authority(fetchImpl).mayActAs(
      { ...ana, userId: "ana/../root" },
      "acme?x=1",
    );
    expect(calls[0]?.url).toBe(
      "https://host.test/people/ana%2F..%2Froot/tenants/acme%3Fx%3D1",
    );
  });

  it("asks once for repeated questions and caches the answer", async () => {
    const { fetchImpl, calls } = answering(200);
    const tenants = authority(fetchImpl);
    await tenants.mayActAs(ana, "acme");
    await tenants.mayActAs(ana, "acme");
    expect(calls).toHaveLength(1);
  });

  it("does not cache a no when the negative cache is zero seconds", async () => {
    const { fetchImpl, calls } = answering(404);
    const tenants = authority(fetchImpl, { negativeCacheSeconds: 0 });
    await tenants.mayActAs(ana, "acme");
    await tenants.mayActAs(ana, "acme");
    // A zero-second negative cache must not be read as "cache forever".
    expect(calls).toHaveLength(2);
  });

  it("does not reuse one tenant's answer for another", async () => {
    const { fetchImpl, calls } = answering(200);
    const tenants = authority(fetchImpl);
    await tenants.mayActAs(ana, "acme");
    await tenants.mayActAs(ana, "globex");
    expect(calls).toHaveLength(2);
  });

  it("does not reuse an answer computed for different groups", async () => {
    const { fetchImpl, calls } = answering(200);
    const tenants = authority(fetchImpl);
    await tenants.mayActAs(ana, "acme");
    await tenants.mayActAs({ ...ana, groups: ["finance"] }, "acme");
    expect(calls).toHaveLength(2);
  });

  it("throws rather than denying when the host cannot answer", async () => {
    // A 500 answered as "not entitled" would lock every caller out of every
    // tenant for as long as the outage lasted, and look like a working server.
    const { fetchImpl } = answering(503);
    await expect(authority(fetchImpl).mayActAs(ana, "acme")).rejects.toThrow(
      EndpointError,
    );
  });

  it("throws on a 401, which means this server's own credential was refused", async () => {
    const { fetchImpl } = answering(401);
    await expect(authority(fetchImpl).mayActAs(ana, "acme")).rejects.toThrow(
      EndpointError,
    );
  });

  it("lets a 200 say no through entitledPath", async () => {
    const { fetchImpl } = answering(200, { entry: { entitled: false } });
    await expect(
      authority(fetchImpl, { entitledPath: "entry.entitled" }).mayActAs(
        ana,
        "acme",
      ),
    ).resolves.toBe(false);
  });

  it("refuses an answer whose entitledPath matches nothing, and says why", async () => {
    const onReject = vi.fn();
    const { fetchImpl } = answering(200, { entry: {} });
    await expect(
      authority(fetchImpl, {
        entitledPath: "entry.entitled",
        onReject,
      }).mayActAs(ana, "acme"),
    ).resolves.toBe(false);
    expect(onReject).toHaveBeenCalledWith(
      expect.stringContaining("entry.entitled"),
    );
  });

  it("sends the ids in the body for POST", async () => {
    const { fetchImpl, calls } = answering(200);
    await authority(fetchImpl, {
      method: "POST",
      url: "https://host.test/entitlements",
    }).mayActAs(ana, "acme");
    await expect(calls[0]?.json()).resolves.toEqual({
      userId: "ana",
      tenantId: "acme",
      groups: ["engineering"],
    });
  });

  describe("configuration it refuses to start with", () => {
    it("refuses a GET url with no {tenantId}", () => {
      // It would ask the same question for every tenant, and the first yes
      // would be cached as a yes for all of them.
      expect(() =>
        createHttpTenantAuthority({
          url: "https://host.test/people/{userId}/tenants",
        }),
      ).toThrow(/\{tenantId\}/);
    });

    it("refuses a GET url with no {userId}", () => {
      expect(() =>
        createHttpTenantAuthority({
          url: "https://host.test/tenants/{tenantId}",
        }),
      ).toThrow(/\{userId\}/);
    });

    it("allows a POST url with neither, because the body carries them", () => {
      expect(() =>
        createHttpTenantAuthority({
          url: "https://host.test/entitlements",
          method: "POST",
        }),
      ).not.toThrow();
    });

    it("refuses a placeholder in the host, which would pick who answers", () => {
      // The value comes from a request, so `{tenantId}.host.test` lets a
      // caller name the host that decides whether they are entitled.
      expect(() =>
        createHttpTenantAuthority({
          url: "https://{tenantId}.host.test/people/{userId}",
        }),
      ).toThrow(/scheme, credentials, host or port/);
    });

    it("refuses placeholders that sit in the fragment", () => {
      // Both are present, so the presence check is satisfied, but a fragment
      // is never sent: every caller would ask about the same URL and a single
      // yes would entitle all of them.
      expect(() =>
        createHttpTenantAuthority({
          url: "https://host.test/entitlements#{userId}/{tenantId}",
        }),
      ).toThrow(/fragment/);
    });

    it("refuses a url that is not https", () => {
      expect(() =>
        createHttpTenantAuthority({
          url: "http://host.test/people/{userId}/tenants/{tenantId}",
        }),
      ).toThrow();
    });
  });
});

describe("createFixedTenantAuthority", () => {
  it("allows the one tenant and refuses every other", async () => {
    const tenants = createFixedTenantAuthority("acme");
    await expect(tenants.mayActAs(ana, "acme")).resolves.toBe(true);
    await expect(tenants.mayActAs(ana, "globex")).resolves.toBe(false);
  });

  it("refuses to be built with an empty tenant", () => {
    expect(() => createFixedTenantAuthority("  ")).toThrow(EndpointError);
  });
});

import { describe, expect, it, vi } from "vitest";
import { EndpointError } from "../net/endpoint";
import { NO_CAPABILITIES, type DashboardIdentity } from "../seams/identity";
import { createHttpScopeAuthority } from "./scope-http";

const MEMBERSHIP_URL =
  "https://host.test/people/{userId}/sites/{scopeId}?tenant={tenantId}";

const ana: DashboardIdentity = {
  userId: "ana",
  tenantId: "acme",
  kind: "user",
  capabilities: { ...NO_CAPABILITIES },
};

const answering = (status: number, body: unknown = {}): typeof fetch =>
  vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  ) as unknown as typeof fetch;

const authority = (
  fetchImpl: typeof fetch,
  options: Partial<Parameters<typeof createHttpScopeAuthority>[0]> = {},
) =>
  createHttpScopeAuthority({
    url: MEMBERSHIP_URL,
    fetchImpl,
    ...options,
  });

describe("createHttpScopeAuthority", () => {
  it("refuses a membership URL that is not https", () => {
    // Whoever answers it decides who this server lets in.
    expect(() =>
      authority(answering(200), { url: "http://host.test/{scopeId}" }),
    ).toThrowError(EndpointError);
  });

  it("takes a role the host already spells the same way", async () => {
    const scopes = authority(answering(200, { role: "Editor" }));
    await expect(scopes.resolveScopeRole(ana, "ops")).resolves.toBe("Editor");
  });

  it("maps the host's own role names", async () => {
    const scopes = authority(
      answering(200, { entry: { role: "SiteManager" } }),
      {
        rolePath: "entry.role",
        roleMap: {
          SiteManager: "Coordinator",
          SiteCollaborator: "Editor",
          SiteContributor: "Contributor",
          SiteConsumer: "Consumer",
        },
      },
    );
    await expect(scopes.resolveScopeRole(ana, "ops")).resolves.toBe(
      "Coordinator",
    );
  });

  it("denies a role the mapping does not cover, and says so", async () => {
    const onReject = vi.fn();
    const scopes = authority(answering(200, { role: "SiteManager" }), {
      roleMap: { SiteConsumer: "Consumer" },
      onReject,
    });
    await expect(scopes.resolveScopeRole(ana, "ops")).resolves.toBeNull();
    expect(onReject).toHaveBeenCalledWith(
      expect.stringContaining("SiteManager"),
    );
  });

  it("denies a role that is not one of ours when there is no mapping", async () => {
    const onReject = vi.fn();
    const scopes = authority(answering(200, { role: "admin" }), { onReject });
    await expect(scopes.resolveScopeRole(ana, "ops")).resolves.toBeNull();
    expect(onReject).toHaveBeenCalledWith(expect.stringContaining("admin"));
  });

  it("does not read a role off the prototype", async () => {
    // `constructor` is a function on every object; read as a role it is a
    // grant the host never made.
    const scopes = authority(answering(200, {}), { rolePath: "constructor" });
    await expect(scopes.resolveScopeRole(ana, "ops")).resolves.toBeNull();
  });

  it("treats 404 as not a member, with no diagnostic", async () => {
    // An ordinary refusal. Logging it would write a line per unauthorized
    // request, which is a caller deciding how much this process logs.
    const onReject = vi.fn();
    const scopes = authority(answering(404), { onReject });
    await expect(scopes.resolveScopeRole(ana, "ops")).resolves.toBeNull();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("reports a 200 with no role, which is usually a wrong role path", async () => {
    const onReject = vi.fn();
    const scopes = authority(answering(200, { entry: {} }), { onReject });
    await expect(scopes.resolveScopeRole(ana, "ops")).resolves.toBeNull();
    expect(onReject).toHaveBeenCalledWith(expect.stringContaining("role"));
  });

  it("throws when the host cannot answer, rather than denying", async () => {
    // A denial is indistinguishable from "not a member", so an outage would
    // present as a working server that has locked everybody out.
    const scopes = authority(answering(503));
    await expect(scopes.resolveScopeRole(ana, "ops")).rejects.toThrowError(
      EndpointError,
    );
  });

  it("throws on a 401, because that is this server's own credential", async () => {
    const scopes = authority(answering(401));
    await expect(scopes.resolveScopeRole(ana, "ops")).rejects.toThrowError(
      EndpointError,
    );
  });

  it("fills the identity into the URL and encodes it", async () => {
    const call = answering(200, { role: "Consumer" });
    await authority(call).resolveScopeRole(ana, "../../admin");
    expect(call).toHaveBeenCalledWith(
      new URL("https://host.test/people/ana/sites/..%2F..%2Fadmin?tenant=acme"),
      expect.anything(),
    );
  });

  it("sends the service credential with every lookup", async () => {
    const call = answering(200, { role: "Consumer" });
    await authority(call, {
      headers: { authorization: "Bearer service-token" },
    }).resolveScopeRole(ana, "ops");
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer service-token",
        }),
      }),
    );
  });

  it("sends the question as a body when configured to POST", async () => {
    const call = answering(200, { role: "Consumer" });
    await authority(call, { method: "POST" }).resolveScopeRole(
      { ...ana, groups: ["engineering"] },
      "ops",
    );
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          tenantId: "acme",
          userId: "ana",
          groups: ["engineering"],
          scopeId: "ops",
        }),
      }),
    );
  });

  it("asks once for repeated questions", async () => {
    const call = answering(200, { role: "Editor" });
    const scopes = authority(call);
    await scopes.resolveScopeRole(ana, "ops");
    await scopes.resolveScopeRole(ana, "ops");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not answer one scope from another scope's lookup", async () => {
    const call = answering(200, { role: "Editor" });
    const scopes = authority(call);
    await scopes.resolveScopeRole(ana, "ops");
    await scopes.resolveScopeRole(ana, "finance");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not answer one tenant from another tenant's lookup", async () => {
    // The same user id in two tenants is two different people.
    const call = answering(200, { role: "Editor" });
    const scopes = authority(call);
    await scopes.resolveScopeRole(ana, "ops");
    await scopes.resolveScopeRole({ ...ana, tenantId: "other" }, "ops");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("asks again when the caller's groups have changed", async () => {
    // A host may answer from the groups, so an answer computed for the old
    // ones must not be reused for a token carrying new ones.
    const call = answering(200, { role: "Editor" });
    const scopes = authority(call);
    await scopes.resolveScopeRole({ ...ana, groups: ["a"] }, "ops");
    await scopes.resolveScopeRole({ ...ana, groups: ["a", "b"] }, "ops");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("reuses an answer when the same groups arrive in a different order", async () => {
    const call = answering(200, { role: "Editor" });
    const scopes = authority(call);
    await scopes.resolveScopeRole({ ...ana, groups: ["a", "b"] }, "ops");
    await scopes.resolveScopeRole({ ...ana, groups: ["b", "a"] }, "ops");
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("what the membership URL must and must not carry", () => {
  it("refuses a GET that leaves out who is being asked about", () => {
    // Without {userId} the host is asked the same question for everyone.
    expect(() =>
      authority(answering(200), { url: "https://host.test/sites/{scopeId}" }),
    ).toThrowError(/\{userId\}/);
  });

  it("refuses a GET that leaves out where", () => {
    expect(() =>
      authority(answering(200), { url: "https://host.test/people/{userId}" }),
    ).toThrowError(/\{scopeId\}/);
  });

  it("does not need {tenantId}, since a single-tenant host has nowhere to put it", () => {
    expect(() =>
      authority(answering(200), {
        url: "https://host.test/people/{userId}/sites/{scopeId}",
      }),
    ).not.toThrow();
  });

  it("lets a POST carry the question in the body instead", () => {
    expect(() =>
      authority(answering(200), {
        url: "https://host.test/membership",
        method: "POST",
      }),
    ).not.toThrow();
  });

  it("refuses a placeholder in the host, whatever the method", () => {
    // Encoding the value does not help: a host name needs no slash to be a
    // different host, and the service credential would be sent there.
    expect(() =>
      authority(answering(200), {
        url: "https://{scopeId}.host.test/people/{userId}",
      }),
    ).toThrowError(/scheme, credentials, host or port/);
  });
});

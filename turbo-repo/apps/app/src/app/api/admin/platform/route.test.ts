import { beforeEach, describe, expect, it, vi } from "vitest";

const { forwardToQuarkus } = vi.hoisted(() => ({ forwardToQuarkus: vi.fn() }));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({ forwardToQuarkus }));

import { GET as getMyRoles } from "./roles/me/route";
import { GET as getRole, PUT as putRole } from "./roles/[roleCode]/route";
import { GET as listDomains } from "./branding/domains/route";
import {
  DELETE as deleteDomain,
  GET as getDomain,
  PUT as putDomain,
} from "./branding/domains/[domain]/route";
import { POST as createOrg } from "./orgs/route";
import { PUT as putOrgRole } from "./orgs/[slug]/roles/[roleCode]/route";

const FORWARDED = { ok: true };

beforeEach(() => {
  forwardToQuarkus.mockReset();
  forwardToQuarkus.mockResolvedValue(FORWARDED);
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/app/api/admin/platform", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("platform roles proxy", () => {
  it("forwards the caller's own roles", async () => {
    await getMyRoles();

    expect(forwardToQuarkus).toHaveBeenCalledWith("/api/v1/platform/roles/me");
  });

  it("forwards a role read", async () => {
    await getRole(new Request("http://localhost"), {
      params: Promise.resolve({ roleCode: "PLATFORM_OWNER" }),
    });

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/roles/PLATFORM_OWNER",
    );
  });

  it("forwards a role replacement with its body", async () => {
    const body = { assigneeIds: ["owner@example.test"] };

    await putRole(jsonRequest(body), {
      params: Promise.resolve({ roleCode: "PLATFORM_OWNER" }),
    });

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/roles/PLATFORM_OWNER",
      { method: "PUT", body },
    );
  });

  it("answers 400 to an unparseable body rather than forwarding it", async () => {
    const request = new Request("http://localhost", {
      method: "PUT",
      body: "not json",
    });

    const response = await putRole(request, {
      params: Promise.resolve({ roleCode: "PLATFORM_OWNER" }),
    });

    expect(response.status).toBe(400);
    expect(forwardToQuarkus).not.toHaveBeenCalled();
  });
});

describe("platform organizations proxy", () => {
  it("forwards an organization creation with its body", async () => {
    const body = { slug: "acme", name: "Acme", tenantClientId: "client-1" };

    await createOrg(jsonRequest(body));

    expect(forwardToQuarkus).toHaveBeenCalledWith("/api/v1/platform/orgs", {
      method: "POST",
      body,
    });
  });

  it("encodes the slug and role code of an organization role replacement", async () => {
    const body = { assigneeIds: ["owner@example.test"] };

    await putOrgRole(jsonRequest(body), {
      params: Promise.resolve({ slug: "a/b", roleCode: "ORGANIZATION_OWNER" }),
    });

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/orgs/a%2Fb/roles/ORGANIZATION_OWNER",
      { method: "PUT", body },
    );
  });

  it("answers 400 to an unparseable body rather than forwarding it", async () => {
    const created = await createOrg(
      new Request("http://localhost", { method: "POST", body: "not json" }),
    );
    const replaced = await putOrgRole(
      new Request("http://localhost", { method: "PUT", body: "not json" }),
      {
        params: Promise.resolve({
          slug: "acme",
          roleCode: "ORGANIZATION_OWNER",
        }),
      },
    );

    expect(created.status).toBe(400);
    expect(replaced.status).toBe(400);
    expect(forwardToQuarkus).not.toHaveBeenCalled();
  });
});

describe("platform branding proxy", () => {
  it("forwards the domain list", async () => {
    await listDomains();

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/branding/domains",
    );
  });

  it("forwards a single domain read", async () => {
    await getDomain(new Request("http://localhost"), {
      params: Promise.resolve({ domain: "portal.example.com" }),
    });

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/branding/domains/portal.example.com",
    );
  });

  it("forwards a save with its body", async () => {
    const body = {
      logoDataUrl: "data:image/png;base64,AAA",
      homeUrl: null,
      active: true,
    };

    await putDomain(jsonRequest(body), {
      params: Promise.resolve({ domain: "portal.example.com" }),
    });

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/branding/domains/portal.example.com",
      { method: "PUT", body },
    );
  });

  it("escapes the domain instead of interpolating it raw", async () => {
    await deleteDomain(new Request("http://localhost"), {
      params: Promise.resolve({ domain: "../../v1/orgs" }),
    });

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/branding/domains/..%2F..%2Fv1%2Forgs",
      { method: "DELETE" },
    );
  });
});

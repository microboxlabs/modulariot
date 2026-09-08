import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteDomainBranding,
  domainLogoUrl,
  fetchDomainBrandings,
  fetchMyPlatformRoles,
  fetchPlatformOwnerRole,
  fetchStoredLogoDataUrl,
  saveDomainBranding,
  updatePlatformOwnerRole,
} from "./platform-data-service";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function jsonOk(body: unknown) {
  return { ok: true, json: async () => body };
}

describe("platform role calls", () => {
  it("reads the caller's own roles", async () => {
    fetchMock.mockResolvedValue(jsonOk({ roleCodes: ["PLATFORM_OWNER"] }));

    await expect(fetchMyPlatformRoles()).resolves.toEqual({
      roleCodes: ["PLATFORM_OWNER"],
    });
    expect(fetchMock).toHaveBeenCalledWith("/app/api/admin/platform/roles/me");
  });

  it("reads the owner role's assignees", async () => {
    fetchMock.mockResolvedValue(
      jsonOk({ roleCode: "PLATFORM_OWNER", assigneeIds: [], bootstrapAssigneeIds: [] }),
    );

    await fetchPlatformOwnerRole();

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/platform/roles/PLATFORM_OWNER",
    );
  });

  it("replaces the assignees wholesale", async () => {
    fetchMock.mockResolvedValue(jsonOk({}));

    await updatePlatformOwnerRole(["owner@example.test"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/platform/roles/PLATFORM_OWNER",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: ["owner@example.test"] }),
      },
    );
  });
});

describe("domain branding calls", () => {
  it("lists the configured domains", async () => {
    fetchMock.mockResolvedValue(jsonOk([]));

    await fetchDomainBrandings();

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/platform/branding/domains",
    );
  });

  it("sends the logo, home URL and active flag on a save", async () => {
    fetchMock.mockResolvedValue(jsonOk({}));
    const value = {
      logoDataUrl: "data:image/png;base64,AAA",
      logoDarkDataUrl: "data:image/png;base64,BBB",
      homeUrl: "https://example.test/",
      active: true,
    };

    await saveDomainBranding("portal.example.com", value);

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/platform/branding/domains/portal.example.com",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      },
    );
  });

  it("escapes the domain rather than interpolating it raw", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await deleteDomainBranding("a b/c");

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/platform/branding/domains/a%20b%2Fc",
      { method: "DELETE" },
    );
  });

  it("surfaces the upstream's own explanation of a rejected save", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Unsupported logo type: application/pdf" }),
    });

    await expect(
      saveDomainBranding("portal.example.com", {
        logoDataUrl: "data:application/pdf;base64,AAA",
        logoDarkDataUrl: null,
        homeUrl: null,
        active: true,
      }),
    ).rejects.toThrow("Unsupported logo type: application/pdf");
  });

  it("falls back to the status when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(deleteDomainBranding("portal.example.com")).rejects.toThrow(
      "Request failed with status 502",
    );
  });
});

describe("stored logo", () => {
  it("busts the cache with the ETag", () => {
    expect(domainLogoUrl("portal.example.com", "abc/123")).toBe(
      "/app/api/admin/platform/branding/domains/portal.example.com/logo?v=abc%2F123",
    );
  });

  it("addresses the dark variant separately", () => {
    expect(domainLogoUrl("portal.example.com", "dark456", "dark")).toBe(
      "/app/api/admin/platform/branding/domains/portal.example.com/logo?v=dark456&variant=dark",
    );
  });

  it("re-reads the stored dark bytes from the dark URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["<svg id=\"d\"/>"], { type: "image/svg+xml" }),
    });

    await fetchStoredLogoDataUrl("portal.example.com", "dark456", "dark");

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/platform/branding/domains/portal.example.com/logo?v=dark456&variant=dark",
    );
  });

  it("re-reads the stored bytes as a data: URL an edit can resend", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["<svg/>"], { type: "image/svg+xml" }),
    });

    await expect(
      fetchStoredLogoDataUrl("portal.example.com", "abc"),
    ).resolves.toBe(`data:image/svg+xml;base64,${btoa("<svg/>")}`);
  });

  it("throws when the stored logo cannot be read back", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    await expect(
      fetchStoredLogoDataUrl("portal.example.com", "abc"),
    ).rejects.toThrow("Request failed with status 404");
  });
});

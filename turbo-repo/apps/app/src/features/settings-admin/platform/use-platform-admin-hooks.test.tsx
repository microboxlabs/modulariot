import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  fetchPlatformOwnerRole: vi.fn(),
  updatePlatformOwnerRole: vi.fn(),
  fetchDomainBrandings: vi.fn(),
  saveDomainBranding: vi.fn(),
  deleteDomainBranding: vi.fn(),
}));
vi.mock("./platform-data-service", () => service);

import { useDomainBrandings } from "./use-domain-brandings";
import { usePlatformOwnerRole } from "./use-platform-owner-role";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

const ROW = {
  domain: "portal.example.com",
  logoMime: "image/png",
  logoEtag: "etag-1",
  homeUrl: null,
  active: true,
  updatedAt: "2026-09-05T03:04:46.807Z",
  updatedBy: "owner@example.test",
};

beforeEach(() => {
  Object.values(service).forEach((fn) => fn.mockReset());
  service.fetchPlatformOwnerRole.mockResolvedValue({
    roleCode: "PLATFORM_OWNER",
    assigneeIds: ["first@example.test"],
    bootstrapAssigneeIds: [],
  });
  service.fetchDomainBrandings.mockResolvedValue([ROW]);
});

describe("usePlatformOwnerRole", () => {
  it("shows the saved assignees without waiting for a refetch", async () => {
    const updated = {
      roleCode: "PLATFORM_OWNER",
      assigneeIds: ["second@example.test"],
      bootstrapAssigneeIds: [],
    };
    service.updatePlatformOwnerRole.mockResolvedValue(updated);

    const { result } = renderHook(() => usePlatformOwnerRole(), { wrapper });
    await waitFor(() => expect(result.current.role).not.toBeNull());

    await act(async () => {
      await result.current.save(["second@example.test"]);
    });

    expect(result.current.role).toEqual(updated);
    // The response seeds the cache, so the list is not read back.
    expect(service.fetchPlatformOwnerRole).toHaveBeenCalledTimes(1);
  });

  it("stops reporting itself busy after a failed save", async () => {
    service.updatePlatformOwnerRole.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => usePlatformOwnerRole(), { wrapper });
    await waitFor(() => expect(result.current.role).not.toBeNull());

    await act(async () => {
      await expect(result.current.save([])).rejects.toThrow("boom");
    });

    expect(result.current.isSaving).toBe(false);
  });

  it("surfaces a failed load as an error rather than an empty role", async () => {
    service.fetchPlatformOwnerRole.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => usePlatformOwnerRole(), { wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.role).toBeNull();
  });
});

describe("useDomainBrandings", () => {
  it("re-reads the list after a save, because the domain is normalized upstream", async () => {
    service.saveDomainBranding.mockResolvedValue(ROW);

    const { result } = renderHook(() => useDomainBrandings(), { wrapper });
    await waitFor(() => expect(result.current.domains).toHaveLength(1));

    await act(async () => {
      await result.current.save("PORTAL.Example.COM", {
        logoDataUrl: "data:image/png;base64,AAA",
        homeUrl: null,
        active: true,
      });
    });

    expect(service.fetchDomainBrandings).toHaveBeenCalledTimes(2);
  });

  it("re-reads the list after a delete", async () => {
    service.deleteDomainBranding.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDomainBrandings(), { wrapper });
    await waitFor(() => expect(result.current.domains).toHaveLength(1));

    await act(async () => {
      await result.current.remove("portal.example.com");
    });

    expect(service.deleteDomainBranding).toHaveBeenCalledWith(
      "portal.example.com"
    );
    expect(service.fetchDomainBrandings).toHaveBeenCalledTimes(2);
  });

  it("starts from an empty list rather than undefined", () => {
    service.fetchDomainBrandings.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDomainBrandings(), { wrapper });

    expect(result.current.domains).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});

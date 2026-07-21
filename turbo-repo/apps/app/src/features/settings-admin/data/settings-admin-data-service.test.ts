import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchContentReviewPermission,
  updateContentReviewPermission,
} from "./settings-admin-data-service";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("content review permission data service", () => {
  const response = {
    enabled: true,
    permissionCode: "CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE",
    roleCode: "CONTENT_REVIEW_AUTO_APPROVER",
    alfrescoGroupId: "GROUP_MINTRAL_AUTO_APPROVERS_77856310K",
    assigneeIds: ["reviewer@example.com"],
    projectionStatus: "SYNCED",
    projectionError: null,
    projectedAt: "2026-07-21T12:00:00Z",
  };

  it("loads the organization-scoped setting", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });

    await expect(fetchContentReviewPermission("acme chile")).resolves.toEqual(
      response
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/orgs/acme%20chile/permissions/content-review-auto-approval"
    );
  });

  it("replaces the setting with JSON", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });

    await updateContentReviewPermission("acme", {
      enabled: true,
      assigneeIds: ["reviewer@example.com"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/orgs/acme/permissions/content-review-auto-approval",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          assigneeIds: ["reviewer@example.com"],
        }),
      }
    );
  });
});

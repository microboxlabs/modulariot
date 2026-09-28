import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchContentReviewPermission,
  fetchHarnessTrainerPermission,
  updateContentReviewPermission,
  updateHarnessTrainerPermission,
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
    assigneeIds: ["reviewer@example.com"],
  };

  it("loads the organization-scoped setting", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });

    await expect(fetchContentReviewPermission("acme chile")).resolves.toEqual(
      response
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/orgs/acme%20chile/permissions/CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE"
    );
  });

  it("replaces the setting with JSON", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });

    await updateContentReviewPermission("acme", {
      enabled: true,
      assigneeIds: ["reviewer@example.com"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/orgs/acme/permissions/CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE",
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

describe("harness trainer permission data service", () => {
  const response = {
    enabled: true,
    permissionCode: "HARNESS_TRAINER",
    roleCode: "HARNESS_TRAINER",
    assigneeIds: ["trainer-1"],
  };

  it("loads the trainer permission", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });

    await expect(fetchHarnessTrainerPermission("acme")).resolves.toEqual(
      response
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/orgs/acme/permissions/HARNESS_TRAINER"
    );
  });

  it("replaces the trainer list with JSON", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });

    await updateHarnessTrainerPermission("acme", {
      enabled: true,
      assigneeIds: ["trainer-1"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/app/api/admin/orgs/acme/permissions/HARNESS_TRAINER",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, assigneeIds: ["trainer-1"] }),
      }
    );
  });
});

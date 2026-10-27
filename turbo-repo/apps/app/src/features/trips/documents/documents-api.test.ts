import { tripsRequest } from "../monitors/monitors-api";
vi.mock("../monitors/monitors-api", async (original) => ({
  ...(await original<typeof import("../monitors/monitors-api")>()),
  tripsRequest: vi.fn().mockResolvedValue({}),
}));
vi.mock("swr", async (original) => ({
  ...(await original<typeof import("swr")>()),
  mutate: vi.fn().mockResolvedValue(undefined),
}));
import { describe, expect, it } from "vitest";
import { isReviewableEntry } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/reviewable";
import { versionOf } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/viewer/observations/review-version";
import {
  createTripsSource,
  documentContentUrl,
  toEntry,
  toRound,
  type TripDocument,
} from "./documents-api";

const TRIP = "11111111-1111-1111-1111-111111111111";

function doc(patch: Partial<TripDocument> = {}): TripDocument {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    tripId: TRIP,
    contentId: "33333333-3333-3333-3333-333333333333",
    name: "front.jpg",
    docType: "PICKUP_FRONT_IMAGE",
    version: 2,
    reviewable: true,
    reviewStatus: "rejected",
    reviewedAt: "2026-10-26T10:00:00Z",
    reviewedBy: "ops@example.com",
    deliveryId: null,
    mimetype: "image/jpeg",
    size: 1200,
    createdAt: "2026-10-26T09:00:00Z",
    createdBy: "ops@example.com",
    updatedAt: "2026-10-26T10:00:00Z",
    updatedBy: "ops@example.com",
    ...patch,
  };
}

describe("trip documents in the multimedia component", () => {
  it("reads a document as the node the component expects", () => {
    const entry = toEntry(doc());
    expect(entry.entry.properties?.["mintral:contentType"]).toBe(
      "PICKUP_FRONT_IMAGE"
    );
    expect(entry.entry.properties?.["mintral:reviewStatus"]).toBe("REJECTED");
    expect(entry.entry.content?.mimeType).toBe("image/jpeg");
    expect(isReviewableEntry(entry)).toBe(true);
    expect(versionOf(entry.entry)).toBe("2");
  });

  it("gives a type without review no review state", () => {
    const entry = toEntry(
      doc({ reviewable: false, reviewStatus: null, reviewedAt: null })
    );
    expect(isReviewableEntry(entry)).toBe(false);
    expect(entry.entry.properties?.["mintral:reviewStatus"]).toBeUndefined();
  });

  it("matches a review round to a version with the same label", () => {
    const round = toRound({
      seq: 1,
      version: 2,
      verdict: "APPROVED",
      reasons: [],
      comment: null,
      reviewedBy: "ops@example.com",
      decidedAt: "2026-10-26T10:00:00Z",
    });
    expect(round.version).toBe(versionOf(toEntry(doc()).entry));
  });

  it("reviews the exact displayed snapshot without truncating timestamp precision", async () => {
    const source = createTripsSource(TRIP, "en");
    const modifiedAt = "2026-10-26T10:00:00.123456Z";
    await source.recordRound(doc().id, "APPROVED", [], undefined, modifiedAt);
    expect(tripsRequest).toHaveBeenCalledWith(
      `/api/trips/${TRIP}/documents/${doc().id}/reviews`,
      {
        method: "POST",
        body: {
          expectedUpdatedAt: modifiedAt,
          verdict: "APPROVED",
          reasons: [],
          comment: undefined,
        },
      }
    );
    expect(source.reviewStatusIsCurrent).toBe(true);
  });

  it("serves the file inline or as a download", () => {
    const id = doc().id;
    expect(documentContentUrl(TRIP, id)).toBe(
      `/api/trips/documents/content?trip=${TRIP}&doc=${id}`
    );
    expect(documentContentUrl(TRIP, id, true)).toContain("download=1");
  });
});

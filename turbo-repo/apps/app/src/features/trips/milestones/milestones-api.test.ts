import { beforeEach, describe, expect, it, vi } from "vitest";
import { tripsRequest } from "../monitors/monitors-api";
import {
  confirmMilestone,
  rejectMilestone,
  type TripMilestone,
} from "./milestones-api";

vi.mock("../monitors/monitors-api", () => ({ tripsRequest: vi.fn() }));

const milestone: TripMilestone = {
  tripId: "11111111-1111-1111-1111-111111111111",
  milestone: "departure",
  status: "pending",
  source: "gps",
  proposedAt: "2026-10-25T08:32:00Z",
  evidence: {},
  confirmedAt: null,
  confirmedBy: null,
  channel: null,
};

describe("trip milestone actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms at the trip's milestone endpoint", async () => {
    await confirmMilestone(milestone);
    expect(tripsRequest).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/trips\/11111111-1111-1111-1111-111111111111\/milestones\/departure\/confirm$/
      ),
      {
        method: "POST",
        body: {
          channel: "ui",
          expectedDetection: {
            proposedAt: milestone.proposedAt,
            source: milestone.source,
          },
        },
      }
    );
  });

  it("rejects at the same trip's milestone endpoint", async () => {
    await rejectMilestone(milestone, null);
    expect(tripsRequest).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/trips\/11111111-1111-1111-1111-111111111111\/milestones\/departure\/reject$/
      ),
      {
        method: "POST",
        body: {
          channel: "ui",
          note: null,
          expectedDetection: {
            proposedAt: milestone.proposedAt,
            source: milestone.source,
          },
        },
      }
    );
  });
});

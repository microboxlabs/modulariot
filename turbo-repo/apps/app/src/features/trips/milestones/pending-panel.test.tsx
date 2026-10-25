import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingMilestone } from "./milestones-api";
import PendingPanel from "./pending-panel";

const pending: PendingMilestone = {
  milestone: {
    tripId: "11111111-1111-1111-1111-111111111111",
    milestone: "departure",
    status: "pending",
    source: "timer",
    proposedAt: "2026-10-25T08:32:00Z",
    evidence: {},
    confirmedAt: null,
    confirmedBy: null,
    channel: null,
  },
  serviceCode: "SAMPLE-001",
  origin: null,
  destination: null,
  plannedStart: null,
};

vi.mock("@/features/i18n/tr.service", () => ({ tr: (key: string) => key }));
vi.mock("../monitors/monitors-api", () => ({
  useTripsPermission: () => false,
}));
vi.mock("./milestones-api", () => ({
  MILESTONE_CONFIRM: "trips:milestone.confirm",
  usePendingMilestones: () => ({ data: [pending], isLoading: false }),
}));

describe("pending trip milestones", () => {
  it("shows a fallback label for a source without a translation", () => {
    render(<PendingPanel d={{}} lang="en" />);
    expect(screen.getByText("SAMPLE-001")).toBeInTheDocument();
    expect(screen.getByText("sources.other")).toBeInTheDocument();
    expect(screen.queryByText("sources.timer")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LANE_STATE } from "@/features/shipping/hooks/use-lane-view-state";
import { boardQuery, type BoardCard, type BoardLane } from "./board-api";
import { TripLane } from "./trip-lane";

vi.mock("@/features/i18n/tr.service", () => ({
  trDynamic: (key: string) => key,
  tr: (key: string, _d: unknown, vars?: Record<string, string>) =>
    vars ? `${key} ${Object.values(vars).join("/")}` : key,
}));
vi.mock("../monitors/monitors-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../monitors/monitors-api")>()),
  tripsRequest: vi.fn(),
}));

const card: BoardCard = {
  tripId: "11111111-1111-1111-1111-111111111111",
  lane: "departure_pending",
  status: "in_progress",
  label: "EN PREPARACION",
  codes: ["SAMPLE-101"],
  origin: "Origin A",
  destination: "Destination B",
  truck: "AB-123",
  trailer: null,
  driver: null,
  secondDriver: null,
  carrier: null,
  plannedStart: "2026-10-25T08:00:00Z",
  plannedArrival: "2026-10-26T08:00:00Z",
  departedAt: null,
  arrivedAt: null,
  actualEnd: null,
  currentStage: "preparation",
  milestones: { departure: "pending" },
  alerts: ["departure_overdue"],
  monitorKey: "sample",
  regularized: false,
  cancelReason: null,
  updatedAt: null,
};

function lane(patch: Partial<BoardLane> = {}): BoardLane {
  return { key: "departure_pending", count: 1, cards: [card], ...patch };
}

describe("trips board", () => {
  it("passes the search and only the finished view's date range", () => {
    const search = new URLSearchParams({
      q: "SAMPLE",
      date_range_from: "2026-10-01 00:00:00",
      date_range_to: "2026-10-07 23:59:59",
    });
    expect(boardQuery("planning", search)).toBe("?q=SAMPLE");
    const finished = new URLSearchParams(
      boardQuery("finished", search).slice(1)
    );
    expect(finished.get("q")).toBe("SAMPLE");
    expect(finished.get("from")).toMatch(/^2026-(09-30|10-01)T/);
    expect(finished.get("to")).toMatch(/^2026-10-0[78]T/);
    expect(boardQuery("dispatch", new URLSearchParams())).toBe("");
  });

  it("shows a lane's cards with the tenant label, resources and milestones", () => {
    render(
      <TripLane
        lane={lane()}
        d={{}}
        lang="en"
        compact={false}
        laneState={DEFAULT_LANE_STATE}
        onLaneUpdate={() => undefined}
      />
    );
    expect(screen.getByText("lanes.departure_pending")).toBeInTheDocument();
    expect(screen.getByText("SAMPLE-101")).toBeInTheDocument();
    expect(screen.getByText("EN PREPARACION")).toBeInTheDocument();
    expect(screen.getByText("card.noDriver")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/trips/${card.tripId}`
    );
    expect(screen.getByTitle("card.overdue")).toBeInTheDocument();
    expect(screen.getByText("milestone.departure")).toHaveAttribute(
      "title",
      "milestone.departure: milestoneStatus.pending"
    );
    expect(screen.queryByText("milestone.presentation")).toBeNull();
  });

  it("shows presentation and validation once a source reported them", () => {
    render(
      <TripLane
        lane={lane({
          cards: [
            {
              ...card,
              milestones: { presentation: "confirmed", validation: "pending" },
            },
          ],
        })}
        d={{}}
        lang="en"
        compact={false}
        laneState={DEFAULT_LANE_STATE}
        onLaneUpdate={() => undefined}
      />
    );
    expect(screen.getByText("milestone.validation")).toHaveAttribute(
      "title",
      "milestone.validation: milestoneStatus.pending"
    );
    expect(screen.getByText("milestone.presentation")).toBeInTheDocument();
  });

  it("says when a lane shows only its first cards, and when it is empty", () => {
    const { rerender } = render(
      <TripLane
        lane={lane({ count: 250 })}
        d={{}}
        lang="en"
        compact
        laneState={DEFAULT_LANE_STATE}
        onLaneUpdate={() => undefined}
      />
    );
    expect(screen.getByText("more 1/250")).toBeInTheDocument();
    rerender(
      <TripLane
        lane={lane({ count: 0, cards: [] })}
        d={{}}
        lang="en"
        compact
        laneState={DEFAULT_LANE_STATE}
        onLaneUpdate={() => undefined}
      />
    );
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
});

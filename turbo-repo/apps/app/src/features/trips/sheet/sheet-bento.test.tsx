import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripMilestone } from "../milestones/milestones-api";
import type { TripSheet } from "./sheet-api";
import { MilestoneChecklist, nextMilestone } from "./milestone-checklist";
import { elapsed } from "./sheet-head";
import {
  alertText,
  Drivers,
  Progress,
  sheetDrivers,
  tripType,
} from "./sheet-tiles";

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useMyAccess: () => ({ access: { teams: [] } }),
}));
vi.mock("../monitors/monitors-api", () => ({
  tripsRequest: vi.fn(),
  useTripsPermission: () => true,
}));

const ORDER = [
  "presentation",
  "validation",
  "departure",
  "arrival",
  "closure",
] as const;

function milestones(
  status: Partial<Record<(typeof ORDER)[number], TripMilestone["status"]>>
): TripMilestone[] {
  return ORDER.map((milestone) => ({
    tripId: "11111111-1111-1111-1111-111111111111",
    milestone,
    status: status[milestone] ?? "open",
    source: null,
    proposedAt: null,
    evidence: {},
    confirmedAt:
      status[milestone] === "confirmed" ? "2026-10-25T08:00:00Z" : null,
    confirmedBy: null,
    channel: null,
  }));
}

function sheet(ms: TripMilestone[]): TripSheet {
  return {
    card: {
      tripId: "11111111-1111-1111-1111-111111111111",
      lane: "closure",
      status: "unloading",
      label: null,
      codes: ["SAMPLE-1"],
      origin: "A",
      destination: "B",
      truck: "TEST-1",
      trailer: null,
      driver: "Driver",
      secondDriver: null,
      carrier: null,
      plannedStart: "2026-10-25T07:00:00Z",
      plannedArrival: null,
      departedAt: null,
      arrivedAt: null,
      actualEnd: null,
      currentStage: null,
      milestones: {},
      alerts: [],
      monitorKey: null,
      regularized: false,
      cancelReason: null,
      updatedAt: null,
      delivery: {
        loads: 2,
        reached: { delivered: 1, accepted: 0, settled: 0 },
        pending: false,
      },
    },
    stages: [],
    milestones: ms,
    confirmers: {},
    transitions: [],
    feed: null,
    deliveries: null,
    details: null,
  };
}

describe("trip bento", () => {
  it("acts next on a pending milestone, else the first open after the last confirmed", () => {
    expect(
      nextMilestone(milestones({ departure: "confirmed", closure: "pending" }))
        ?.milestone
    ).toBe("closure");
    expect(
      nextMilestone(
        milestones({ departure: "confirmed", arrival: "confirmed" })
      )?.milestone
    ).toBe("closure");
    expect(nextMilestone(milestones({}))?.milestone).toBe("presentation");
    expect(
      nextMilestone(
        milestones(Object.fromEntries(ORDER.map((m) => [m, "confirmed"])))
      )
    ).toBeNull();
  });

  it("writes how long the trip has run in days, hours and minutes", () => {
    const now = new Date("2026-10-26T10:17:00Z");
    expect(elapsed("2026-10-25T06:00:00Z", now)).toBe("1d 4h 17m");
    expect(elapsed("2026-10-26T10:00:00Z", now)).toBe("17m");
  });

  it("names an overdue alert by its milestone", () => {
    expect(alertText("departure_overdue", {})).toBe(
      "milestone.departure · card.overdue"
    );
    expect(alertText("custom", {})).toBe("custom");
  });

  it("opens a milestone from the checklist", () => {
    const onOpen = vi.fn();
    render(
      <MilestoneChecklist
        sheet={sheet(milestones({ departure: "confirmed" }))}
        d={{}}
        lang="en"
        onOpen={onOpen}
      />
    );
    fireEvent.click(screen.getByText("milestone.arrival"));
    expect(onOpen).toHaveBeenCalledWith("arrival");
  });

  it("shows milestones, stages and delivered loads as progress", () => {
    render(
      <Progress sheet={sheet(milestones({ departure: "confirmed" }))} d={{}} />
    );
    expect(screen.getByText("(1 / 5)")).toBeInTheDocument();
    expect(screen.getByText("(1 / 2)")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("tells a trip from an own site from a customer pickup", () => {
    expect(tripType("plant")).toBe("own");
    expect(tripType("distribution_center")).toBe("own");
    expect(tripType("customer")).toBe("pickup");
    expect(tripType("zone")).toBe("unknown");
    expect(tripType(null)).toBe("unknown");
  });

  it("keeps both driver slots, filling what the fleet does not know with dashes", () => {
    const card = sheet([]).card;
    const [first, second] = sheetDrivers(card, null);
    expect(first.name).toBe("Driver");
    expect(second).toEqual({
      name: null,
      rut: null,
      phone: null,
      validations: [],
    });
    render(<Drivers card={card} details={null} d={{}} lang="en" />);
    expect(screen.getByText("sheet.driver2")).toBeInTheDocument();
    expect(screen.getAllByText("-")).toHaveLength(5);
    expect(screen.queryByText("sheet.validations")).toBeNull();
  });

  it("shows a driver's validations only when an external system sent some", () => {
    const base = sheet([]);
    render(
      <Drivers
        card={base.card}
        details={{
          orders: [],
          carrier: null,
          originType: null,
          destinationType: null,
          drivers: [
            {
              name: "Driver",
              rut: "1-9",
              phone: null,
              validations: [
                {
                  type: "TEST",
                  key: "ALCOHOL",
                  value: "PASSED",
                  source: "checks",
                  validUntil: null,
                },
              ],
            },
          ],
        }}
        d={{}}
        lang="en"
      />
    );
    expect(screen.getAllByText("sheet.validations")).toHaveLength(1);
    expect(screen.getByText("ALCOHOL")).toBeInTheDocument();
  });
});

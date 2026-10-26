import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripMilestone } from "../milestones/milestones-api";
import type { TripSheet } from "./sheet-api";
import { nextMilestone } from "./milestone-checklist";
import {
  checkValue,
  groupChecks,
  serviceChecks,
  ServiceValidations,
} from "./checks";
import { SheetTables } from "./sheet-tables";
import { elapsed } from "./sheet-head";
import {
  alertText,
  Drivers,
  leadTimeRate,
  occupancy,
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

const EMPTY_LOAD = {
  units: 0,
  weightKg: null,
  volumeM3: null,
  weightCapacityKg: null,
  volumeCapacityM3: null,
};
const NO_LEAD = { onTime: 0, late: 0, open: 0, withoutSla: 0 };

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

  it("opens a milestone from the milestones tab", () => {
    const onOpen = vi.fn();
    render(
      <SheetTables
        sheet={sheet(milestones({ departure: "confirmed" }))}
        d={{}}
        lang="en"
        onMilestone={onOpen}
      />
    );
    fireEvent.click(screen.getByText("milestone.arrival"));
    expect(onOpen).toHaveBeenCalledWith("arrival");
  });

  it("reads a check as true, false or not reported", () => {
    expect(checkValue(true)).toBe(true);
    expect(checkValue(false)).toBe(false);
    expect(checkValue("TRUE")).toBe(true);
    expect(checkValue("false")).toBe(false);
    expect(checkValue(null)).toBeUndefined();
    expect(checkValue(undefined)).toBeUndefined();
    expect(checkValue("ACCREDITED")).toBeUndefined();
  });

  it("takes the service's checks from the milestones before departure, grouped by key prefix", () => {
    const ms = milestones({});
    ms[0] = { ...ms[0], evidence: { "equipment.gps": true, operator: "x" } };
    ms[1] = {
      ...ms[1],
      evidence: { "cargo.consolidation": false, "cargo.documents": null },
    };
    ms[2] = { ...ms[2], evidence: { "cargo.ignored": true } };
    const checks = serviceChecks(sheet(ms));
    expect(checks.map((c) => [c.key, c.value])).toEqual([
      ["equipment.gps", true],
      ["cargo.consolidation", false],
      ["cargo.documents", undefined],
    ]);
    expect(groupChecks(checks).map(([g, cs]) => [g, cs.length])).toEqual([
      ["equipment", 1],
      ["cargo", 2],
    ]);
  });

  it("says so when the source sent no validations", () => {
    render(<ServiceValidations sheet={sheet(milestones({}))} d={{}} />);
    expect(screen.getByText("sheet.noValidations")).toBeInTheDocument();
  });

  it("shows the loads delivered, not milestones or stages", () => {
    render(
      <Progress sheet={sheet(milestones({ departure: "confirmed" }))} d={{}} />
    );
    expect(screen.getByText("(1 / 2)")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.queryByText("sheet.milestones")).toBeNull();
    expect(screen.queryByText("sheet.plan")).toBeNull();
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
          load: EMPTY_LOAD,
          leadTime: NO_LEAD,
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

  it("rates the lead time over the mandates delivered, none before any", () => {
    expect(leadTimeRate(NO_LEAD)).toBeNull();
    expect(leadTimeRate({ ...NO_LEAD, onTime: 3, late: 1, open: 2 })).toBe(75);
  });

  it("takes the fuller of weight and volume as the occupancy", () => {
    expect(occupancy(EMPTY_LOAD)).toBeNull();
    expect(
      occupancy({ ...EMPTY_LOAD, units: 2, weightKg: 1500, volumeM3: 4 })
    ).toBeNull();
    const occ = occupancy({
      units: 2,
      weightKg: 14000,
      volumeM3: 60,
      weightCapacityKg: 28000,
      volumeCapacityM3: 80,
    });
    expect(occ).toMatchObject({ key: "volume", pct: 75 });
  });

  it("shows lead time and occupancy without data as dashes", () => {
    render(<Progress sheet={sheet(milestones({}))} d={{}} />);
    expect(screen.getByText("sheet.leadTime")).toBeInTheDocument();
    expect(screen.getByText("sheet.occupancy")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});

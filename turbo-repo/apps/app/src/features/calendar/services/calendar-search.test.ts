import { describe, expect, it } from "vitest";
import {
  assignmentStateOf,
  isCalendarSearchActive,
  matchesCalendarSearch,
  parseCalendarSearchParams,
  type CalendarSearchParams,
} from "./calendar-search";
import type { SelectedService } from "@/features/calendar/components/planning/planning-selection-types";

function service(patch: Partial<SelectedService> = {}): SelectedService {
  return {
    id: "1626876-v",
    mintral_serviceCode: "1626876",
    cliente: "ACME Minerals",
    origen: "SCL",
    lugarCarguio: "",
    destino: "ANF",
    tipoViaje: "Sider",
    ocupacion: 0,
    permanencia: "24h",
    leadTime: {
      total_lineasoc_cumplen: 0,
      total_lineasoc_incumplen: 0,
      lineasoc_pctn_cumplimiento: 0,
    },
    eta: "",
    incidencias: [],
    observaciones: "",
    prioridad: 0,
    ...patch,
  };
}

function params(patch: Partial<CalendarSearchParams> = {}): CalendarSearchParams {
  return {
    service: [],
    customer: [],
    origin: [],
    destination: [],
    licensePlate: [],
    tipoViaje: [],
    assignment: [],
    ...patch,
  };
}

describe("parseCalendarSearchParams", () => {
  it("splits comma-joined values, since text badges accumulate chips", () => {
    const p = parseCalendarSearchParams(
      new URLSearchParams("service=1626876,1626877&customer=ACME")
    );
    expect(p.service).toEqual(["1626876", "1626877"]);
    expect(p.customer).toEqual(["ACME"]);
  });

  it("trims whitespace and drops empties", () => {
    const p = parseCalendarSearchParams(
      new URLSearchParams("origin= SCL , ,ANF,")
    );
    expect(p.origin).toEqual(["SCL", "ANF"]);
  });

  it("drops assignment values that are not real states", () => {
    const p = parseCalendarSearchParams(
      new URLSearchParams("assignment=unassigned,bogus")
    );
    expect(p.assignment).toEqual(["unassigned"]);
  });

  it("ignores params belonging to other sections", () => {
    // The kanban's badges write these; the calendar must not act on them.
    const p = parseCalendarSearchParams(
      new URLSearchParams("driverId=11111111-1&originType=INTERNAL")
    );
    expect(isCalendarSearchActive(p)).toBe(false);
  });
});

describe("isCalendarSearchActive", () => {
  it("is false when nothing is set", () => {
    expect(
      isCalendarSearchActive(parseCalendarSearchParams(new URLSearchParams()))
    ).toBe(false);
  });

  it("is true as soon as any param has a value", () => {
    expect(isCalendarSearchActive(params({ assignment: ["unassigned"] }))).toBe(
      true
    );
  });
});

describe("assignmentStateOf", () => {
  it("is unassigned with no crew", () => {
    expect(assignmentStateOf(service())).toBe("unassigned");
  });

  it("is assigned only on the full carrier+driver+truck tuple", () => {
    expect(
      assignmentStateOf(
        service({
          assignedCarrier: "carrier-uuid",
          assignedDriver: "driver-uuid",
          assignedTruck: "truck-uuid",
        })
      )
    ).toBe("assigned");
  });

  it("ignores the trailer, which the assignment treats as nullable", () => {
    // A trailer alone is not progress toward a complete tuple.
    expect(assignmentStateOf(service({ assignedTrailer: "trailer-uuid" }))).toBe(
      "unassigned"
    );
    // And a full tuple stays "assigned" without one.
    expect(
      assignmentStateOf(
        service({
          assignedCarrier: "c",
          assignedDriver: "d",
          assignedTruck: "t",
        })
      )
    ).toBe("assigned");
  });

  it("is partial when the tuple is incomplete", () => {
    expect(
      assignmentStateOf(
        service({ assignedCarrier: "c", assignedDriver: "d" })
      )
    ).toBe("partial");
  });
});

describe("matchesCalendarSearch", () => {
  it("matches a service by its display id or its stable code", () => {
    expect(
      matchesCalendarSearch(service(), params({ service: ["1626876-v"] }))
    ).toBe(true);
    // The user types the code; the id carries a "-v" suffix they don't know.
    expect(
      matchesCalendarSearch(service(), params({ service: ["1626876"] }))
    ).toBe(true);
  });

  it("matches text case-insensitively on a substring", () => {
    expect(
      matchesCalendarSearch(service(), params({ customer: ["acme"] }))
    ).toBe(true);
  });

  it("finds the plate on the truck or the trailer", () => {
    const s = service({
      assignedTruckExternalId: "JJKK11",
      assignedTrailerExternalId: "LLMM22",
    });
    expect(
      matchesCalendarSearch(s, params({ licensePlate: ["JJKK11"] }))
    ).toBe(true);
    expect(
      matchesCalendarSearch(s, params({ licensePlate: ["llmm22"] }))
    ).toBe(true);
    expect(
      matchesCalendarSearch(s, params({ licensePlate: ["ZZZZ99"] }))
    ).toBe(false);
  });

  it("ORs the terms within one param", () => {
    expect(
      matchesCalendarSearch(service(), params({ origin: ["ANF", "SCL"] }))
    ).toBe(true);
    expect(
      matchesCalendarSearch(service(), params({ origin: ["ANF", "IQQ"] }))
    ).toBe(false);
  });

  it("ANDs across params", () => {
    // Right client, wrong destination -> no match.
    expect(
      matchesCalendarSearch(
        service(),
        params({ customer: ["ACME"], destination: ["IQQ"] })
      )
    ).toBe(false);
    expect(
      matchesCalendarSearch(
        service(),
        params({ customer: ["ACME"], destination: ["ANF"] })
      )
    ).toBe(true);
  });

  it("treats trip type as an exact value, not a substring", () => {
    const doble = service({ tipoViaje: "Doble Sider" });
    expect(
      matchesCalendarSearch(doble, params({ tipoViaje: ["Doble Sider"] }))
    ).toBe(true);
    // "Sider" must not match "Doble Sider" — that is the whole point of a select.
    expect(matchesCalendarSearch(doble, params({ tipoViaje: ["Sider"] }))).toBe(
      false
    );
  });

  it("finds planned-but-uncrewed services, the reason this search exists", () => {
    const uncrewed = service();
    const crewed = service({
      assignedCarrier: "c",
      assignedDriver: "d",
      assignedTruck: "t",
    });
    const p = params({ assignment: ["unassigned"] });
    expect(matchesCalendarSearch(uncrewed, p)).toBe(true);
    expect(matchesCalendarSearch(crewed, p)).toBe(false);
  });

  it("does not match a missing field against a searched term", () => {
    // No plate assigned yet: searching a plate must not match it.
    expect(
      matchesCalendarSearch(service(), params({ licensePlate: ["JJKK11"] }))
    ).toBe(false);
  });
});

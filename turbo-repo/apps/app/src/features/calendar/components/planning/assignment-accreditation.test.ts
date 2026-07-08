/**
 * Coverage for the assignment-accreditation aggregate the calendar card/chip
 * render: weakest-link level across the assigned resources, skipping slots
 * whose level is unknown (legacy bookings / row not on the loaded page).
 */
import { describe, it, expect } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  getAssignmentAccreditation,
  assignmentAccreditationTooltip,
} from "./assignment-accreditation";
import type { SelectedService } from "./planning-selection-types";

function makeService(overrides: Partial<SelectedService> = {}): SelectedService {
  return {
    id: "1626876-v",
    cliente: "Cliente",
    origen: "SCL",
    lugarCarguio: "SCL",
    destino: "ANF",
    tipoViaje: "Sider",
    ocupacion: 0,
    permanencia: "",
    leadTime: {
      total_lineasoc_cumplen: 0,
      total_lineasoc_incumplen: 0,
      lineasoc_pctn_cumplimiento: null,
    },
    eta: "",
    incidencias: [],
    observaciones: "",
    prioridad: 0,
    ...overrides,
  };
}

const dict = {
  pages: {
    planning: {
      sidebar: {
        assignment: {
          carrier: "Transportista",
          driver: "Conductor",
          secondDriver: "Segundo Conductor",
          truck: "Camión",
          trailer: "Remolque",
          enabled: "Acreditado",
          notEnabled: "No Acreditado",
          superAccredited: "Súper Acreditado",
        },
      },
    },
  },
} as unknown as I18nRecord;

describe("getAssignmentAccreditation", () => {
  it("returns null when nothing is assigned", () => {
    expect(getAssignmentAccreditation(makeService())).toBeNull();
  });

  it("returns null for legacy bookings that persisted ids but no levels", () => {
    const service = makeService({
      assignedCarrier: "carrier-1",
      assignedDriver: "driver-1",
      assignedTruck: "truck-1",
    });
    expect(getAssignmentAccreditation(service)).toBeNull();
  });

  it("skips slots whose level is null (row not on the loaded page)", () => {
    const service = makeService({
      assignedCarrier: "carrier-1",
      assignedCarrierAccreditation: null,
      assignedDriver: "driver-1",
      assignedDriverAccreditation: "superAccredited",
    });
    const result = getAssignmentAccreditation(service);
    expect(result?.level).toBe("superAccredited");
    expect(result?.entries).toHaveLength(1);
  });

  it("ignores stale levels on slots that are no longer assigned", () => {
    const service = makeService({
      assignedCarrierAccreditation: "notAccredited",
    });
    expect(getAssignmentAccreditation(service)).toBeNull();
  });

  it("is superAccredited only when every assigned resource is", () => {
    const service = makeService({
      assignedCarrier: "carrier-1",
      assignedCarrierAccreditation: "superAccredited",
      assignedDriver: "driver-1",
      assignedDriverAccreditation: "superAccredited",
      assignedTruck: "truck-1",
      assignedTruckAccreditation: "superAccredited",
    });
    expect(getAssignmentAccreditation(service)?.level).toBe("superAccredited");
  });

  it("degrades to the weakest level across resources, including driver2/trailer", () => {
    const service = makeService({
      assignedCarrier: "carrier-1",
      assignedCarrierAccreditation: "superAccredited",
      assignedDriver: "driver-1",
      assignedDriverAccreditation: "accredited",
      assignedDriver2: "driver-2",
      assignedDriver2Accreditation: "superAccredited",
      assignedTrailer: "trailer-1",
      assignedTrailerAccreditation: "superAccredited",
    });
    expect(getAssignmentAccreditation(service)?.level).toBe("accredited");

    const withNotAccredited = makeService({
      ...service,
      assignedTrailerAccreditation: "notAccredited",
    });
    expect(getAssignmentAccreditation(withNotAccredited)?.level).toBe(
      "notAccredited"
    );
  });
});

describe("assignmentAccreditationTooltip", () => {
  it("renders one translated '<slot>: <level>' line per known resource", () => {
    const service = makeService({
      assignedCarrier: "carrier-1",
      assignedCarrierAccreditation: "superAccredited",
      assignedTruck: "truck-1",
      assignedTruckAccreditation: "notAccredited",
    });
    const summary = getAssignmentAccreditation(service);
    expect(summary).not.toBeNull();
    expect(assignmentAccreditationTooltip(summary!, dict)).toBe(
      "Transportista: Súper Acreditado\nCamión: No Acreditado"
    );
  });
});

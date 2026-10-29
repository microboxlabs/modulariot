import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import VehicleDescription from "./vehicle-description";

const estado = vi.hoisted(() => ({
  permisos: ["fleet:assets.view"] as string[],
  detalle: undefined as unknown,
  pedido: [] as Array<{ id: string; enabled: boolean }>,
}));

vi.mock("@/features/settings-admin/team/team-api", () => ({
  useMyAccess: () => ({
    access: undefined,
    accessError: undefined,
    can: (p: string) => estado.permisos.includes(p),
  }),
}));

vi.mock("@/features/fleet/fleet-api", async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    useFleetAsset: (id: string, enabled: boolean) => {
      estado.pedido.push({ id, enabled });
      return { data: enabled ? estado.detalle : undefined };
    },
  };
});

const dict = {
  geographic_view: {
    vehicle_model: "Modelo",
    vehicle_no_model: "Sin modelo",
    vehicle_year: "Año",
  },
} as unknown as I18nRecord;

function detalle(fields: Record<string, string | null>) {
  return {
    fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
  };
}

describe("VehicleDescription", () => {
  beforeEach(() => {
    estado.permisos = ["fleet:assets.view"];
    estado.detalle = undefined;
    estado.pedido = [];
  });

  it("shows the model and the year of the asset", () => {
    estado.detalle = detalle({ brandModel: "Volvo FH 540", year: "2021" });
    render(<VehicleDescription assetId="ABCD12" dict={dict} />);
    expect(screen.getByText("Modelo: Volvo FH 540")).toBeTruthy();
    expect(screen.getByText("Año: 2021")).toBeTruthy();
    expect(estado.pedido.at(-1)).toEqual({ id: "ABCD12", enabled: true });
  });

  it("says Sin modelo when the model is empty and leaves out an empty year", () => {
    estado.detalle = detalle({ brandModel: null, year: null });
    render(<VehicleDescription assetId="ABCD12" dict={dict} />);
    expect(screen.getByText("Modelo: Sin modelo")).toBeTruthy();
    expect(screen.queryByText(/Año:/)).toBeNull();
  });

  it("doesn't fetch the asset without the fleet view permission", () => {
    estado.permisos = [];
    estado.detalle = detalle({ brandModel: "Volvo FH 540", year: "2021" });
    const { container } = render(
      <VehicleDescription assetId="ABCD12" dict={dict} />
    );
    expect(container.textContent).toBe("");
    expect(estado.pedido.at(-1)?.enabled).toBe(false);
  });
});

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import MapLayersCard, {
  CAPAS_POR_DEFECTO,
  capasDeVista,
  formaCapa,
  useCapasMapa,
} from "./map-layers-card";

const dict = {
  geographic_view: {
    layers: {
      title: "Capas",
      vehiculos: "Vehículos",
      geocercas: "Geocercas",
      trayectos: "Trayectos",
    },
  },
} as unknown as I18nRecord;

describe("map layers card", () => {
  beforeEach(() => globalThis.localStorage.clear());

  it("shows every layer by default and remembers the last choice", () => {
    const { result } = renderHook(() => useCapasMapa());
    expect(result.current[0]).toEqual(CAPAS_POR_DEFECTO);
    act(() => result.current[1]("vehiculos", false));
    expect(result.current[0].vehiculos).toBe(false);
    // a new visit starts with what was chosen last
    const otra = renderHook(() => useCapasMapa());
    expect(otra.result.current[0]).toEqual({
      ...CAPAS_POR_DEFECTO,
      vehiculos: false,
    });
  });

  it("ignores unknown or broken saved layers", () => {
    globalThis.localStorage.setItem(
      "geographic-view:capas",
      JSON.stringify({ geocercas: false, nombres: false })
    );
    expect(renderHook(() => useCapasMapa()).result.current[0]).toEqual({
      ...CAPAS_POR_DEFECTO,
      geocercas: false,
    });
    globalThis.localStorage.setItem("geographic-view:capas", "{roto");
    expect(renderHook(() => useCapasMapa()).result.current[0]).toEqual(
      CAPAS_POR_DEFECTO
    );
  });

  it("keeps the geofences off if the old Geocercas button was off", () => {
    globalThis.localStorage.setItem("geographic-view:ver-geocercas", "0");
    const { result } = renderHook(() => useCapasMapa());
    expect(result.current[0]).toEqual({
      ...CAPAS_POR_DEFECTO,
      geocercas: false,
    });
  });

  it("offers only the layers each view draws", () => {
    expect(capasDeVista(null)).toEqual(["vehiculos", "geocercas"]);
    expect(capasDeVista("places")).toEqual(["geocercas", "trayectos"]);
  });

  it("switches a layer from its on/off button", () => {
    const onCambiar = vi.fn();
    render(
      <MapLayersCard
        dict={dict}
        capas={{ ...CAPAS_POR_DEFECTO, geocercas: false }}
        disponibles={["vehiculos", "geocercas"]}
        onCambiar={onCambiar}
      />
    );
    expect(screen.getByRole("region", { name: "Capas" })).toBeInTheDocument();
    expect(screen.queryByText("Trayectos")).toBeNull();
    const geocercas = screen.getByRole("button", { name: "Geocercas" });
    expect(geocercas).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(geocercas);
    expect(onCambiar).toHaveBeenCalledWith("geocercas", true);
    const vehiculos = screen.getByRole("button", { name: "Vehículos" });
    expect(vehiculos).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(vehiculos);
    expect(onCambiar).toHaveBeenCalledWith("vehiculos", false);
  });

  it("renders nothing on a view without layers", () => {
    const { container } = render(
      <MapLayersCard
        dict={dict}
        capas={CAPAS_POR_DEFECTO}
        disponibles={[]}
        onCambiar={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("joins neighbouring active layers like a button group", () => {
    // alone: a circle; in a run: only the ends of the run are round
    expect(formaCapa(false, false)).toBe("rounded-full");
    expect(formaCapa(false, true)).toBe("rounded-none rounded-t-full");
    expect(formaCapa(true, true)).toBe("rounded-none");
    expect(formaCapa(true, false)).toBe("rounded-none rounded-b-full");

    render(
      <MapLayersCard
        dict={dict}
        capas={{ vehiculos: true, geocercas: true, trayectos: false }}
        disponibles={["vehiculos", "geocercas", "trayectos"]}
        onCambiar={vi.fn()}
      />
    );
    const boton = (name: string) => screen.getByRole("button", { name });
    expect(boton("Vehículos")).toHaveClass("rounded-t-full");
    expect(boton("Vehículos")).not.toHaveClass("rounded-full");
    expect(boton("Geocercas")).toHaveClass("rounded-b-full");
    // an inactive layer has no blue background to shape
    expect(boton("Trayectos")).toHaveClass("rounded-full");
  });
});

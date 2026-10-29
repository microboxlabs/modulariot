import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import MapVisualizationTrip from "./map-visualization-trip";

// lo pesado (mapa, barra, panel, datos) queda fuera: se prueba el marco
vi.mock("@/features/map-visualization/map-visualization", () => ({
  default: ({
    children,
    rounded,
  }: {
    children?: ReactNode;
    rounded?: boolean | "left";
  }) => (
    <div data-testid="mapa" data-rounded={String(rounded)}>
      {children}
    </div>
  ),
}));
vi.mock("@/features/common/providers/client-api.provider", () => ({
  useGeofences: () => ({ geofence_data: null }),
}));
vi.mock("../hooks/use-timelapse", () => ({
  useTimelapse: () => ({ timelapse: null }),
}));
// la barra expone el modo de geocercas como botones para poder cambiarlo
vi.mock("./tool-bar/tool-bar", () => ({
  default: ({
    geofences_mode,
  }: {
    geofences_mode?: {
      geofencesMode: string;
      setGeofencesMode: (m: "all" | "trip" | "none") => void;
    };
  }) => (
    <div data-testid="modo-geocercas" data-modo={geofences_mode?.geofencesMode}>
      {(["all", "trip", "none"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => geofences_mode?.setGeofencesMode(m)}
        >
          {`modo-${m}`}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("./places-overlay/places-floating-overlay", () => ({
  default: ({ externas }: { externas?: { titulo: string } }) =>
    externas ? <span data-testid="externas">{externas.titulo}</span> : null,
}));
vi.mock("../profiles/places-permission", () => ({
  usePermisoEditorLugares: () => true,
}));
vi.mock("@/features/places", async () => ({
  ...(await vi.importActual<object>("@/features/places/panel")),
  PlaceBadgeTooltip: () => null,
  PlacesEditorOverlays: () => null,
  PlacesMapLayers: () => <span data-testid="capas-lugares" />,
  hayBorrador: () => false,
  usePlacesEnMapa: () => ({
    // sin cambios sin guardar: salir de Lugares sigue de inmediato
    ws: { tooltipBadge: null, pedirSalir: (seguir: () => void) => seguir() },
    capasNombres: [],
    propsMapa: {},
  }),
}));

const dict = {
  geographic_view: {
    no_data_found: "Sin datos",
    notch: { label: "Map views", places: "Lugares de interés" },
    trip_geofences: { title: "Geocercas del viaje" },
    layers: {
      title: "Capas",
      vehiculos: "Vehículos",
      geocercas: "Geocercas",
      trayectos: "Trayectos",
    },
  },
} as unknown as I18nRecord;

function renderViaje(over: { isLoading?: boolean; positions?: [] | null }) {
  return render(
    <MapVisualizationTrip
      tripId="t1"
      positions={over.positions ?? []}
      isLoading={over.isLoading ?? false}
      error={null}
      filteredLocationData={null}
      dict={dict}
      selectedTreatmentIndex={null}
    />
  );
}

describe("MapVisualizationTrip controls", () => {
  beforeEach(() => globalThis.localStorage.clear());

  it("shows loading or no data where the distance to origin goes", () => {
    const { rerender } = renderViaje({ positions: [] });
    const estado = () => document.querySelector("[data-estado-viaje]");
    const esquina = () => estado()?.closest("[data-map-controls] > div > div");
    // top centre, the same spot as the distance / ETA pill
    expect(estado()).toHaveTextContent("Sin datos");
    expect(esquina()).toHaveClass("top-0", "left-1/2");

    rerender(
      <MapVisualizationTrip
        tripId="t1"
        positions={[]}
        isLoading
        error={null}
        filteredLocationData={null}
        dict={dict}
        selectedTreatmentIndex={null}
      />
    );
    // loading: same spot, a spinner instead of the text
    expect(estado()).not.toHaveTextContent("Sin datos");
    expect(esquina()).toHaveClass("left-1/2");
  });

  it("drops the status once positions have loaded", () => {
    render(
      <MapVisualizationTrip
        tripId="t1"
        positions={[
          {
            latitude: -33.4,
            longitude: -70.6,
            speed: 0,
            timestamp: "2026-10-20T10:00:00Z",
          } as never,
        ]}
        isLoading={false}
        error={null}
        filteredLocationData={null}
        dict={dict}
        selectedTreatmentIndex={null}
      />
    );
    expect(document.querySelector("[data-estado-viaje]")).toBeNull();
  });

  it("has no Capas pill: places geofences follow the map's own toolbar", () => {
    renderViaje({ positions: [] });
    // the toolbar's geofence mode already covers this
    expect(document.querySelector("[data-capa]")).toBeNull();
  });

  it("shows only the trip's geofences by default", () => {
    renderViaje({ positions: [] });
    expect(screen.getByTestId("modo-geocercas")).toHaveAttribute(
      "data-modo",
      "trip"
    );
    expect(screen.queryByTestId("capas-lugares")).toBeNull();
  });

  it("shows every places geofence with 'all' and none with 'none'", () => {
    renderViaje({ positions: [] });
    fireEvent.click(screen.getByRole("button", { name: "modo-all" }));
    expect(screen.getByTestId("capas-lugares")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "modo-none" }));
    expect(screen.queryByTestId("capas-lugares")).toBeNull();
  });

  it("shows the places geofences while the editor is open, whatever the mode", () => {
    renderViaje({ positions: [] });
    fireEvent.click(screen.getByRole("button", { name: "modo-none" }));
    fireEvent.click(screen.getByRole("button", { name: "Lugares de interés" }));
    expect(screen.getByTestId("capas-lugares")).toBeInTheDocument();
  });

  it("tells the page when Lugares opens and closes", () => {
    const onLugaresChange = vi.fn();
    render(
      <MapVisualizationTrip
        tripId="t1"
        positions={[]}
        isLoading={false}
        error={null}
        filteredLocationData={null}
        dict={dict}
        selectedTreatmentIndex={null}
        onLugaresChange={onLugaresChange}
      />
    );
    const boton = screen.getByRole("button", { name: "Lugares de interés" });
    expect(screen.getByTestId("mapa")).toHaveAttribute("data-rounded", "true");
    fireEvent.click(boton);
    expect(onLugaresChange).toHaveBeenLastCalledWith(true);
    // the edge that meets the Lugares panel goes straight
    expect(screen.getByTestId("mapa")).toHaveAttribute("data-rounded", "left");
    fireEvent.click(boton);
    expect(onLugaresChange).toHaveBeenLastCalledWith(false);
  });

  it("always lists the trip's geofences in Lugares, as in symptoms and bento", () => {
    renderViaje({ positions: [] });
    expect(screen.getByTestId("externas")).toHaveTextContent(
      "Geocercas del viaje"
    );
  });
});

describe("trip map layer order", () => {
  it("draws the geofence names on top only while the editor is open", async () => {
    const { capasDelMapa } = await import("./map-visualization-trip");
    // stand-ins for deck.gl layers: only the order matters here
    const capa = (id: string) => ({ id }) as never;
    const [pulsos, pin, nombres] = [capa("pulsos"), capa("pin"), capa("n")];
    expect(capasDelMapa([pulsos, pin], [nombres], false)).toEqual([
      nombres,
      pulsos,
      pin,
    ]);
    expect(capasDelMapa([pulsos, pin], [nombres], true)).toEqual([
      pulsos,
      pin,
      nombres,
    ]);
  });
});

describe("trip geofence anchor", () => {
  it("goes to the ring's centre, or to the point itself", async () => {
    const { anclaDeGeometria } = await import("./map-visualization-trip");
    expect(
      anclaDeGeometria({
        type: "Polygon",
        coordinates: [
          [
            [-70, -33],
            [-70, -34],
            [-71, -34],
            [-71, -33],
          ],
        ],
      })
    ).toEqual([-33.5, -70.5]);
    expect(
      anclaDeGeometria({ type: "Point", coordinates: [-70.6, -33.4] })
    ).toEqual([-33.4, -70.6]);
    expect(
      anclaDeGeometria({ type: "LineString", coordinates: [] })
    ).toBeNull();
    expect(anclaDeGeometria({ type: "Point" })).toBeNull();
  });
});

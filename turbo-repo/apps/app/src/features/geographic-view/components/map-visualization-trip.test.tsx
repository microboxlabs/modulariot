import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Layer, PickingInfo } from "@deck.gl/core";
import { ScatterplotLayer } from "deck.gl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { MapPosition } from "../types/map";
import { PulsePinLayer } from "./layers/pulse";
import MapVisualizationTrip from "./map-visualization-trip";

const mapState = vi.hoisted(() => ({ layers: [] as Layer[] }));

// lo pesado (mapa, barra, panel, datos) queda fuera: se prueba el marco
const signalNow = vi.hoisted(() => ({ value: null as unknown }));
beforeEach(() => {
  signalNow.value = null;
});
vi.mock("@/features/map-visualization/map-visualization", () => ({
  default: ({
    children,
    rounded,
    layers = [],
  }: {
    children?: ReactNode;
    rounded?: boolean | "left";
    layers?: Layer[];
  }) => {
    mapState.layers = layers;
    return (
      <div data-testid="mapa" data-rounded={String(rounded)}>
        {children}
      </div>
    );
  },
}));
vi.mock("../hooks/use-asset-signal", () => ({
  useAssetSignal: () => signalNow.value,
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

  it("does not show no data when a case has a point but no trip positions", () => {
    render(
      <MapVisualizationTrip
        tripId="demo-case"
        positions={[]}
        casePoint={{ longitude: -70, latitude: -33 }}
        isLoading={false}
        error={null}
        filteredLocationData={null}
        dict={dict}
        selectedTreatmentIndex={null}
      />
    );
    expect(document.querySelector("[data-estado-viaje]")).toBeNull();
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

describe("case map frames", () => {
  const positions = [
    { timestamp: "2026-01-01T09:55:00Z", delay_s: 900, speed: 40 },
    { timestamp: "2026-01-01T10:05:00Z", delay_s: 900, speed: 40 },
    { timestamp: "2026-01-01T10:10:00Z", delay_s: 0, speed: 0 },
  ].map((frame, index) => ({
    assetid: "DEMO-1",
    longitude: 1 + index / 100,
    latitude: 1,
    heading: 0,
    ...frame,
  })) as MapPosition[];
  const caseSpans = [
    {
      start: "2026-01-01T10:00:00Z",
      end: "2026-01-01T10:15:00Z",
      level: 2,
      name: "Demo symptom",
    },
  ];
  const frameDict: I18nRecord = {
    ...dict,
    symptoms: {
      license_plate: "Vehicle",
      compromised_condition: "Compromised condition",
    },
  };
  const props = {
    tripId: "demo-trip",
    positions,
    caseSpans,
    isLoading: false,
    error: null,
    filteredLocationData: null,
    dict: frameDict,
    selectedTreatmentIndex: null,
  };

  function pulseLayer() {
    const layer = mapState.layers.find((item) => item instanceof PulsePinLayer);
    if (!layer) throw new Error("Missing frame layer");
    return layer;
  }

  function markerColor(
    layer: Layer | undefined,
    frame: object,
    accessor: "getFillColor" | "getLineColor" = "getFillColor"
  ) {
    if (!(layer instanceof ScatterplotLayer))
      throw new Error("Missing marker layer");
    const color = layer.props[accessor];
    return typeof color === "function"
      ? color(frame, { index: 0, data: [frame], target: [] })
      : color;
  }

  it("keeps a frame blue and shows its symptom and level when clicked", () => {
    render(<MapVisualizationTrip {...props} />);
    const layer = pulseLayer();
    const frame = layer.props.data.features[1];
    expect(frame.properties).toMatchObject({
      icu_code: 0,
      symptom_level: 2,
      symptom_name: "Demo symptom",
    });
    const moving = layer
      .renderLayers()
      .find((item) => item.id === "pulse-moving-vehicles-layer");
    expect(markerColor(moving, frame)).toEqual([28, 100, 242, 255]);

    act(() => {
      layer.props.onClick({ object: frame } as PickingInfo, {});
    });
    expect(screen.getByText("Demo symptom")).toBeInTheDocument();
    expect(screen.getByText("Compromised condition")).toBeInTheDocument();
  });

  it("rings the selected symptom's frames and keeps late frames amber inside and outside the case", () => {
    const { rerender } = render(<MapVisualizationTrip {...props} />);
    rerender(
      <MapVisualizationTrip
        {...props}
        filteredLocationData={{
          type: "FeatureCollection",
          description: {},
          features: positions.slice(1).map((frame) => ({
            type: "Feature",
            geometry: "Point",
            longitude: frame.longitude,
            latitude: frame.latitude,
            properties: { speed: frame.speed, timestamp: frame.timestamp },
            status: "demo",
          })),
        }}
      />
    );
    const layer = pulseLayer();
    expect(layer.props.selectedPulse).toEqual([1, 2]);
    const selected = layer
      .renderLayers()
      .find((item) => item.id === "pulse-selected-background-layer");
    expect(selected?.props.data).toEqual(layer.props.data.features.slice(1));
    const frame = layer.props.data.features[2];
    expect(markerColor(selected, frame)).toEqual([255, 255, 255, 255]);
    const stopped = layer
      .renderLayers()
      .find((item) => item.id === "pulse-selected-stopped-vehicles-layer");
    expect(markerColor(stopped, frame)).toEqual([255, 255, 255, 255]);
    expect(markerColor(stopped, frame, "getLineColor")).toEqual([
      28, 100, 242, 255,
    ]);
    const late = mapState.layers.find((item) => item.id === "late-frames");
    expect(late?.props).toMatchObject({
      data: positions.slice(0, 2),
      filled: false,
      stroked: true,
      getLineColor: [245, 158, 11, 255],
    });
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

describe("MapVisualizationTrip signal state", () => {
  const frames = [
    {
      assetid: "AB12",
      longitude: -70,
      latitude: -33,
      heading: 0,
      speed: 0,
      timestamp: "2026-11-03T11:00:00Z",
    },
    {
      assetid: "AB12",
      longitude: -70.1,
      latitude: -33.1,
      heading: 0,
      speed: 40,
      timestamp: "2026-11-03T11:48:00Z",
    },
  ];
  const withLabels = {
    ...dict,
    geographic_view: {
      ...(dict.geographic_view as I18nRecord),
      signal_offline: "Sin señal",
      signal_offline_minutes: "Sin señal · hace {n} min",
      signal_offline_hours: "Sin señal · hace {n} h",
    },
  } as unknown as I18nRecord;

  type Drawn = {
    id: string;
    props: {
      offline?: boolean;
      label?: string | null;
      data?: {
        features?: {
          properties: {
            offline?: boolean;
            signal_label?: string | null;
            icu_code?: number;
          };
        }[];
      };
    };
  };
  const layer = (id: string) =>
    (mapState.layers as Drawn[]).find((l) => l.id === id);

  function show(signal: unknown) {
    signalNow.value = signal;
    render(
      <MapVisualizationTrip
        tripId="t1"
        positions={frames as never}
        isLoading={false}
        error={null}
        filteredLocationData={null}
        dict={withLabels}
        selectedTreatmentIndex={null}
      />
    );
  }

  it("draws the current position gray, with how long ago, when offline", () => {
    show({
      state: "offline",
      offline_since: new Date(Date.now() - 12 * 60_000).toISOString(),
      last_frame_at: "2026-11-03T11:48:00Z",
    });
    expect(layer("PinLayer")?.props.offline).toBe(true);
    expect(layer("PinLayer")?.props.label).toBe("Sin señal · hace 12 min");
    const pulses = layer("PulsePinLayer")?.props.data?.features ?? [];
    expect(pulses.map((f) => f.properties.offline)).toEqual([false, true]);
    expect(pulses.map((f) => f.properties.icu_code)).toEqual([0, 0]);
    expect(pulses.map((f) => f.properties.signal_label)).toEqual([
      null,
      "Sin señal · hace 12 min",
    ]);
  });

  it("keeps today's look when online or unknown", () => {
    for (const signal of [{ state: "online" }, { state: "unknown" }, null]) {
      show(signal);
      expect(layer("PinLayer")?.props.offline).toBe(false);
      expect(layer("PinLayer")?.props.label).toBeNull();
    }
  });

  it("is not gray when the map's positions end before the newest frame", () => {
    show({
      state: "offline",
      offline_since: "2026-11-03T11:55:00Z",
      last_frame_at: "2026-11-03T11:55:00Z",
    });
    expect(layer("PinLayer")?.props.offline).toBe(false);
  });
});

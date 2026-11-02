import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GeneralMap from "./general-map";
import PrototypeGeneralMap from "./prototype/prototype-general-map";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import es from "@/lang/es.json";
import en from "@/lang/en.json";

const { general, positions, location } = vi.hoisted(() => ({
  general: vi.fn(),
  positions: vi.fn(),
  location: vi.fn(),
}));

vi.mock("../../hooks/use-treatments-general", () => ({
  useTreatmentsGeneral: general,
}));
vi.mock("@/features/geographic-view/hooks/use-trip-positions", () => ({
  useTripPositions: positions,
}));
vi.mock("@/features/common/providers/client-api.provider", () => ({
  useTreatmentsLocation: location,
}));
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => null,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/symptoms/map-view/-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/features/symptoms/side-info", () => ({ default: () => null }));
vi.mock("./prototype/prototype-side-info", () => ({ default: () => null }));
vi.mock("@/features/geographic-view/components/map-visualization-trip", () => ({
  default: () => null,
}));
vi.mock("../tag-manager", () => ({
  default: ({ tags }: Readonly<{ tags: { text: ReactNode }[] }>) => (
    <div>
      {tags.map((tag, index) => (
        <span key={index}>{tag.text}</span>
      ))}
    </div>
  ),
}));

const tripId = "00000000-0000-4000-8000-000000000001";
const data: TreatmentsGeneralResponseItem = {
  conditions_agg: [],
  trip_info: {
    trip_id: tripId,
    asset_id: "vehicle-demo",
    carrier: "Demo carrier",
    destination: "Destination",
    origin: "Origin",
    driver: "Demo driver",
    type_load: "Demo load",
    driver_contact: "",
  },
  symptom_info: {
    id: -1,
    name: "Demo symptom",
    type: "demo",
    icu_code: 1,
    icu_condition: "UNDER OBSERVATION",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  positions.mockReturnValue({ positions: [], error: null, isLoading: false });
  location.mockReturnValue({ data: null, error: null, isLoading: false });
});

describe.each([
  ["original", GeneralMap],
  ["prototype", PrototypeGeneralMap],
] as const)("%s map trip chip", (_name, Component) => {
  it("shows the service code with the Spanish label and queries positions by UUID", () => {
    general.mockReturnValue({
      treatmentData: {
        ...data,
        trip_info: { ...data.trip_info, trip_code: "SERVICE-001" },
      },
      loading: false,
    });

    render(
      <Component dict={es} id="-1" tripId={tripId} assetId="vehicle-demo" />
    );

    expect(screen.getByText("Viaje: SERVICE-001")).toBeInTheDocument();
    expect(screen.queryByText(`Viaje: ${tripId}`)).not.toBeInTheDocument();
    expect(positions.mock.calls[0].slice(0, 2)).toEqual([
      tripId,
      "vehicle-demo",
    ]);
  });

  it.each([null, undefined, "", "   "])(
    "falls back to the UUID for code %s",
    (trip_code) => {
      general.mockReturnValue({
        treatmentData: { ...data, trip_info: { ...data.trip_info, trip_code } },
        loading: false,
      });
      render(<Component dict={es} id="-1" />);
      expect(screen.getByText(`Viaje: ${tripId}`)).toBeInTheDocument();
    }
  );

  it("keeps a legacy trip id and uses the translated label", () => {
    general.mockReturnValue({
      treatmentData: {
        ...data,
        trip_info: { ...data.trip_info, trip_id: "12345" },
      },
      loading: false,
    });
    render(<Component dict={en} id="1" />);
    expect(screen.getByText("trip: 12345")).toBeInTheDocument();
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TripLocation } from "./locations-api";
import LocationsPanel from "./locations-panel";

const api = vi.hoisted(() => ({
  link: vi.fn(),
  searchError: null as Error | null,
}));
const location: TripLocation = {
  id: "test-location",
  name: "Test location",
  type: "zone",
  externalCode: "TEST",
  geofenceId: null,
  createdAt: null,
  updatedAt: null,
};
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("../monitors/monitors-api", () => ({ useTripsPermission: () => true }));
vi.mock("./locations-api", () => ({
  LOCATION_WRITE: "trips:location.write",
  useLocations: () => ({ data: [location], isLoading: false }),
  useGeofences: () => ({
    data: [{ id: 42, code: "TEST-FENCE", name: "Test geofence" }],
    isLoading: false,
    error: api.searchError,
  }),
  geofenceLabel: () => "Test geofence",
  linkGeofence: (...args: [string, number | null]) => api.link(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.searchError = null;
});

describe("location geofence editor", () => {
  it("keeps the current editor open until the save completes", async () => {
    let complete = () => {};
    api.link.mockImplementation(
      () =>
        new Promise<TripLocation>((resolve) => {
          complete = () => resolve({ ...location, geofenceId: 42 });
        })
    );
    render(<LocationsPanel d={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "assign" }));
    fireEvent.click(screen.getByRole("button", { name: /Test geofence/ }));
    expect(screen.getByRole("button", { name: "cancel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => complete());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("shows search failures and clears previous save errors when reopened", async () => {
    api.searchError = new Error("Test directory unavailable");
    api.link.mockRejectedValue(new Error("Test save failed"));
    render(<LocationsPanel d={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "assign" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Test directory unavailable"
    );
    fireEvent.click(screen.getByRole("button", { name: /Test geofence/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Test save failed")
    );
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "assign" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Test directory unavailable"
    );
    expect(screen.queryByText("Test save failed")).not.toBeInTheDocument();
  });
});

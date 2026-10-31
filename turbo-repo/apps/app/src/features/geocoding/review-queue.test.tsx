import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { manualPoint } from "./place-location-modal";
import type { PlacedLocation } from "./review-api";
import ReviewQueue from "./review-queue";

const api = vi.hoisted(() => ({ place: vi.fn(), reject: vi.fn() }));
const location: PlacedLocation = {
  id: "test-location",
  name: "Test site",
  type: "customer",
  externalCode: "TEST",
  geofenceId: null,
  createdAt: null,
  updatedAt: null,
  address: "Av. Test 101",
  country: "PE",
  districtCode: "150122",
  district: "Miraflores",
  plusCode: null,
  latitude: -12.12,
  longitude: -77.03,
  resolutionSource: "provider",
  resolutionStatus: "needs_review",
  resolutionNote: "the point falls in 150130, not in 150122",
};

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("@/features/trips/monitors/monitors-api", () => ({
  useTripsPermission: () => true,
}));
vi.mock("./point-picker", () => ({
  default: ({
    onPoint,
  }: {
    onPoint: (p: { latitude: number; longitude: number }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onPoint({ latitude: -12.1, longitude: -77.02 })}
    >
      map
    </button>
  ),
}));
vi.mock("./review-api", async (original) => ({
  ...(await original<typeof import("./review-api")>()),
  useReviewQueue: () => ({ data: [location], isLoading: false }),
  placeLocation: (...args: unknown[]) => api.place(...args),
  rejectLocation: (...args: unknown[]) => api.reject(...args),
}));

beforeEach(() => vi.clearAllMocks());

describe("geocoding review queue", () => {
  it("shows each location with the reason it is in review", () => {
    render(<ReviewQueue d={{}} />);
    expect(screen.getByText("Test site")).toBeInTheDocument();
    expect(
      screen.getByText("the point falls in 150130, not in 150122")
    ).toBeInTheDocument();
  });

  it("sends the point set on the map and closes when it is accepted", async () => {
    api.place.mockResolvedValue({ ...location, resolutionStatus: "resolved" });
    render(<ReviewQueue d={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "placeAction" }));
    fireEvent.click(screen.getByRole("button", { name: "map" }));
    fireEvent.click(screen.getByRole("button", { name: "place.save" }));
    await waitFor(() =>
      expect(api.place).toHaveBeenCalledWith("test-location", {
        latitude: -12.1,
        longitude: -77.02,
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "place.save" })
      ).not.toBeInTheDocument()
    );
  });

  it("keeps the modal open with the reason when the district refuses the point", async () => {
    api.place.mockRejectedValue(
      new Error("the point falls in 150130, not in 150122")
    );
    render(<ReviewQueue d={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "placeAction" }));
    fireEvent.click(screen.getByRole("button", { name: "place.save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("150130");
    expect(
      screen.getByRole("button", { name: "place.save" })
    ).toBeInTheDocument();
  });

  it("rejects with the note", async () => {
    api.reject.mockResolvedValue({ ...location, resolutionStatus: "rejected" });
    render(<ReviewQueue d={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "rejectAction" }));
    fireEvent.change(screen.getByLabelText("reject.note"), {
      target: { value: "closed site" },
    });
    fireEvent.click(screen.getByRole("button", { name: "reject.confirm" }));
    await waitFor(() =>
      expect(api.reject).toHaveBeenCalledWith("test-location", "closed site")
    );
  });

  it("prefers a typed Plus Code over the map point", () => {
    const point = { latitude: 1, longitude: 2 };
    expect(manualPoint(" 57R6+XQ ", point)).toEqual({ plusCode: "57R6+XQ" });
    expect(manualPoint("", point)).toEqual(point);
    expect(manualPoint("", null)).toBeNull();
  });
});

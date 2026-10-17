import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  useMapPositions,
  useMapPositionsResume,
} from "@/features/common/providers/client-api.provider";
import { GeographicProfileProvider } from "../profiles/geographic-profile-context";
import { useGeographicProfile } from "../profiles/geographic-profile-context";
import ClientMapStarter from "./client-map-starter";

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useMapPositions: vi.fn(),
  useMapPositionsResume: vi.fn(),
}));

// the signed-in user's permissions; the places editor needs "Editor de lugares"
const permisos = vi.hoisted(() => ({ lista: ["controltower:places.edit"] }));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useMyAccess: () => ({
    access: undefined,
    accessError: undefined,
    can: (p: string) => permisos.lista.includes(p),
  }),
}));

vi.mock("./map-visualization", () => ({
  default: () => <div>map-ready</div>,
}));

const useMapPositionsMock = vi.mocked(useMapPositions);
const useMapPositionsResumeMock = vi.mocked(useMapPositionsResume);

function Harness() {
  const { setActiveView } = useGeographicProfile();
  return (
    <div>
      <button type="button" onClick={() => setActiveView("places")}>
        open-places
      </button>
      <button type="button" onClick={() => setActiveView(null)}>
        open-map
      </button>
      <ClientMapStarter dict={{} as I18nRecord} />
    </div>
  );
}

describe("ClientMapStarter", () => {
  beforeEach(() => {
    useMapPositionsMock.mockReturnValue({
      positions: [],
      isLoading: false,
      isError: false,
      error: undefined,
      count: 0,
      mutate: vi.fn(),
    });
    useMapPositionsResumeMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it("stops loading trucks in places mode and resumes on the normal map", () => {
    render(
      <GeographicProfileProvider>
        <Harness />
      </GeographicProfileProvider>
    );

    expect(screen.getByText("map-ready")).toBeInTheDocument();
    expect(useMapPositionsMock).toHaveBeenCalledWith({ enabled: true });
    expect(useMapPositionsResumeMock).toHaveBeenCalledWith({ enabled: true });

    fireEvent.click(screen.getByRole("button", { name: "open-places" }));
    expect(useMapPositionsMock).toHaveBeenLastCalledWith({ enabled: false });
    expect(useMapPositionsResumeMock).toHaveBeenLastCalledWith({
      enabled: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "open-map" }));
    expect(useMapPositionsMock).toHaveBeenLastCalledWith({ enabled: true });
    expect(useMapPositionsResumeMock).toHaveBeenLastCalledWith({
      enabled: true,
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmersPanel } from "./confirmers-panel";

const request = vi.fn();
const saved = { departure: "team-ops" };
let assignmentsLoading = false;

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("swr", () => ({
  default: () => ({ data: assignmentsLoading ? undefined : saved }),
  mutate: vi.fn(),
}));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useTeams: () => ({
    data: [
      { id: "team-ops", name: "Operaciones" },
      { id: "team-tower", name: "Torre" },
    ],
  }),
}));
vi.mock("./monitors-api", () => ({
  MILESTONES: ["departure", "arrival", "closure"],
  monitorKey: (key: string) => `/api/trips/monitors/${key}`,
  tripsRequest: (...args: unknown[]) => request(...args),
}));

describe("who confirms a monitor's milestones", () => {
  beforeEach(() => {
    assignmentsLoading = false;
    request.mockReset().mockResolvedValue(undefined);
  });

  it("cannot replace assignments before the saved assignments load", () => {
    assignmentsLoading = true;
    render(<ConfirmersPanel monitor="direct" canEdit d={{}} />);
    expect(screen.getByLabelText("milestones.departure")).toBeDisabled();
    expect(screen.getByLabelText("milestones.arrival")).toBeDisabled();
    expect(screen.getByText("confirmers.save")).toBeDisabled();
    expect(request).not.toHaveBeenCalled();
  });

  it("saves the team chosen for each milestone and drops 'anyone'", async () => {
    render(<ConfirmersPanel monitor="direct" canEdit d={{}} />);
    expect(screen.getByLabelText("milestones.departure")).toHaveValue(
      "team-ops"
    );
    expect(screen.getByText("confirmers.save")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("milestones.departure"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("milestones.closure"), {
      target: { value: "team-tower" },
    });
    fireEvent.click(screen.getByText("confirmers.save"));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "/api/trips/monitors/direct/confirmers",
        { method: "PUT", body: { closure: "team-tower" } }
      )
    );
  });

  it("shows the teams read-only without the monitor permission", () => {
    render(<ConfirmersPanel monitor="direct" canEdit={false} d={{}} />);
    expect(screen.getByText("Operaciones")).toBeInTheDocument();
    expect(screen.getAllByText("confirmers.anyone")).toHaveLength(2);
    expect(screen.queryByText("confirmers.save")).not.toBeInTheDocument();
  });
});

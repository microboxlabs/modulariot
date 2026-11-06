import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmNavigation } from "@/features/common/hooks/use-unsaved-navigation";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ControlTowerError } from "../control-tower/control-tower-api";
import es from "@/lang/es.json";
import TeamSettings from "./team-settings";

const team = vi.hoisted(() => ({
  swr: {
    data: { operators: 4, shiftHours: 8, capacityPerShift: 20 } as
      | { operators: number; shiftHours: number; capacityPerShift: number }
      | undefined,
    error: undefined as Error | undefined,
  },
  save: vi.fn(),
  canSettings: true,
}));
vi.mock("./maintainer-api", () => ({
  useTowerTeam: () => team.swr,
  saveTowerTeam: team.save,
  useControlTowerAccess: () => ({ can: () => team.canSettings }),
}));

const c = es.pages.userSettings.symptomCatalog;
const d = c as unknown as I18nRecord;

describe("TeamSettings", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    team.save.mockReset();
    team.swr.data = { operators: 4, shiftHours: 8, capacityPerShift: 20 };
    team.swr.error = undefined;
    team.canSettings = true;
  });

  it("is a section, not a dialog, and links to the Telefonía section", () => {
    render(<TeamSettings d={d} lang="es" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(c.teamTitle)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText(c.telephonyMoved)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: c.telephonyGo })).toHaveAttribute(
      "href",
      "/es/users/settings/symptoms?section=telephony"
    );
  });

  it("saves the team from the saved values and says it saved", async () => {
    team.save.mockResolvedValue(undefined);
    render(<TeamSettings d={d} lang="es" />);
    expect(screen.getByLabelText(c.teamOperators)).toHaveValue("4");
    fireEvent.change(screen.getByLabelText(c.teamOperators), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: c.save }));
    await waitFor(() =>
      expect(team.save).toHaveBeenCalledWith({
        operators: 6,
        shiftHours: 8,
        capacityPerShift: 20,
      })
    );
    expect(await screen.findByText(c.teamSaved)).toBeInTheDocument();
  });

  it("hides the telephony setup link without settings-update access", () => {
    team.canSettings = false;
    render(<TeamSettings d={d} lang="es" />);
    expect(screen.queryByRole("link", { name: c.telephonyGo })).toBeNull();
  });

  it("protects a dirty draft and locks its inputs until the submitted values are saved", async () => {
    let finish = () => {};
    team.save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    render(<TeamSettings d={d} lang="es" />);
    expect(confirmNavigation()).toBe(true);
    fireEvent.change(screen.getByLabelText(c.teamOperators), {
      target: { value: "6" },
    });
    expect(confirmNavigation()).toBe(false);
    expect(confirm).toHaveBeenCalledWith(c.teamUnsaved);
    fireEvent.click(screen.getByRole("button", { name: c.save }));
    for (const label of [c.teamOperators, c.teamShiftHours, c.teamCapacity]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    await act(async () => finish());
    expect(screen.getByLabelText(c.teamOperators)).toHaveValue("6");
    expect(screen.getByLabelText(c.teamOperators)).not.toBeDisabled();
    expect(screen.getByText(c.teamSaved)).toBeInTheDocument();
    expect(confirmNavigation()).toBe(true);
  });

  it("blocks an invalid shift and explains a refused save", async () => {
    team.save.mockRejectedValue(new ControlTowerError("forbidden", 403));
    render(<TeamSettings d={d} lang="es" />);
    fireEvent.change(screen.getByLabelText(c.teamShiftHours), {
      target: { value: "30" },
    });
    expect(screen.getByRole("button", { name: c.save })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(c.teamShiftHours), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: c.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      c.teamOwnersOnly
    );
  });

  it("waits for the saved team before showing the form", () => {
    team.swr.data = undefined;
    render(<TeamSettings d={d} lang="es" />);
    expect(screen.getByRole("status")).toHaveTextContent(c.loading);
    expect(screen.queryByRole("button", { name: c.save })).toBeNull();
  });
});

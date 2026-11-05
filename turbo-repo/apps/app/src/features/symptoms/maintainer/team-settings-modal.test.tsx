import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import TeamSettingsModal from "./team-settings-modal";

const team = vi.hoisted(() => ({
  swr: {
    data: { operators: 4, shiftHours: 8, capacityPerShift: 20 },
    error: undefined,
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
vi.mock("./maintainer-api", () => ({
  useTowerTeam: () => team.swr,
  saveTowerTeam: vi.fn(),
}));

const d = es.pages.userSettings.symptomCatalog as unknown as I18nRecord;

describe("TeamSettingsModal", () => {
  it("links to Conexiones instead of choosing the telephony", () => {
    render(<TeamSettingsModal d={d} onClose={() => undefined} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.getByText(es.pages.userSettings.symptomCatalog.telephonyMoved)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: es.pages.userSettings.symptomCatalog.telephonyConnections,
      })
    ).toHaveAttribute("href", "/es/users/settings/connections");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import dictionary from "@/lang/es.json";
import { Dashlet, defaultConfig } from "./dashlet";
import { DashletSettings } from "./dashlet.settings";
vi.mock("../../context/dashboard-context", () => ({
  useOptionalDashboard: () => ({ dictionary }),
}));
vi.mock("../common/settings-shell", () => ({
  SettingsShell: ({ children, onSave }: Readonly<{ children: ReactNode; onSave: () => void }>) => (
    <div>{children}<button onClick={onSave}>Save</button></div>
  ),
}));
const widget = {
  id: "flex", componentId: "flex_container", config: { ...defaultConfig },
  layout: { i: "flex", x: 0, y: 0, w: 6, h: 3 },
  createdAt: "2026-09-29", updatedAt: "2026-09-29",
};
describe("flex container localized title", () => {
  it("resolves an empty creation default in the current locale without rewriting explicit titles", () => {
    const view = render(<Dashlet widget={widget} editMode={false} />);
    expect(screen.getByRole("heading").textContent).toBe(dictionary.dashboard.defaults.untitled);
    view.rerender(<Dashlet widget={{ ...widget, config: { ...defaultConfig, title: "Untitled" } }} editMode={false} />);
    expect(screen.getByRole("heading").textContent).toBe("Untitled");
  });
  it("saves an empty title without persisting an English display fallback", () => {
    const onSave = vi.fn();
    render(<DashletSettings isOpen onClose={vi.fn()} config={{ ...defaultConfig, title: "   " }} onSave={onSave} dictionary={dictionary} dashletName="Flex" />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({ layout: "row", title: "", description: "" });
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import CommunicationsTabs, {
  COMMUNICATIONS_PANEL_ID,
} from "./communications-tabs";

const d = es.pages.userSettings.communications;

describe("CommunicationsTabs", () => {
  it("keeps only the active tab in the tab order and links the panel", () => {
    render(<CommunicationsTabs tab="templates" d={d} onTab={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Reglas",
      "Plantillas",
      "Actividad",
    ]);
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual([
      "-1",
      "0",
      "-1",
    ]);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-controls")).toBe(COMMUNICATIONS_PANEL_ID);
  });

  it("moves with the arrows, wrapping, and with Home and End", () => {
    const onTab = vi.fn();
    render(<CommunicationsTabs tab="rules" d={d} onTab={onTab} />);
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(onTab).toHaveBeenLastCalledWith("templates");
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(onTab).toHaveBeenLastCalledWith("activity");
    fireEvent.keyDown(list, { key: "End" });
    expect(onTab).toHaveBeenLastCalledWith("activity");
    fireEvent.keyDown(list, { key: "Home" });
    expect(onTab).toHaveBeenLastCalledWith("rules");
    fireEvent.click(screen.getByRole("tab", { name: "Actividad" }));
    expect(onTab).toHaveBeenLastCalledWith("activity");
  });
});

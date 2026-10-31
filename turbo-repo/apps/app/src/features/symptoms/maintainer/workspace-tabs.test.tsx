import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceTabs, { WORKSPACE_PANEL_ID } from "./workspace-tabs";

const d = { workspaceRule: "Regla", workspaceResponse: "Respuesta" };

describe("WorkspaceTabs", () => {
  it("keeps only the active tab in the tab order and links the panel", () => {
    render(
      <WorkspaceTabs
        response={false}
        d={d}
        onRule={vi.fn()}
        onResponse={vi.fn()}
      />
    );
    const rule = screen.getByRole("tab", { name: "Regla" });
    const response = screen.getByRole("tab", { name: "Respuesta" });
    expect(rule.getAttribute("tabindex")).toBe("0");
    expect(response.getAttribute("tabindex")).toBe("-1");
    expect(rule.getAttribute("aria-controls")).toBe(WORKSPACE_PANEL_ID);
  });

  it("switches tabs with the arrow keys, Home and End", () => {
    const onRule = vi.fn();
    const onResponse = vi.fn();
    render(
      <WorkspaceTabs
        response={false}
        d={d}
        onRule={onRule}
        onResponse={onResponse}
      />
    );
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Respuesta" })
    );
    fireEvent.keyDown(list, { key: "Home" });
    expect(onRule).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onRule).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledTimes(1);
  });
});

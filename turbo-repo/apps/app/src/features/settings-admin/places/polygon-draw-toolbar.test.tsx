import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PolygonDrawToolbar from "./polygon-draw-toolbar";

function setup(puedeTerminar = true, cerrado = false) {
  const props = {
    puntos: 3,
    cerrado,
    onSeguir: vi.fn(),
    puedeTerminar,
    puedeDeshacer: true,
    puedeRehacer: true,
    onTerminar: vi.fn(),
    onDeshacer: vi.fn(),
    onRehacer: vi.fn(),
    onCancelar: vi.fn(),
  };
  render(<PolygonDrawToolbar {...props} />);
  return props;
}

describe("PolygonDrawToolbar", () => {
  it("runs each action from its button", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /Terminar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deshacer/ }));
    fireEvent.click(screen.getByRole("button", { name: /Rehacer/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(p.onTerminar).toHaveBeenCalledOnce();
    expect(p.onDeshacer).toHaveBeenCalledOnce();
    expect(p.onRehacer).toHaveBeenCalledOnce();
    expect(p.onCancelar).toHaveBeenCalledOnce();
  });

  it("supports undo/redo shortcuts", () => {
    const p = setup();
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(p.onDeshacer).toHaveBeenCalledOnce();
    expect(p.onRehacer).toHaveBeenCalledTimes(2);
  });

  it("supports Enter, Backspace and Escape", () => {
    const p = setup();
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "Backspace" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(p.onTerminar).toHaveBeenCalledOnce();
    expect(p.onDeshacer).toHaveBeenCalledOnce();
    expect(p.onCancelar).toHaveBeenCalledOnce();
  });

  it("disables finishing below 3 points", () => {
    const p = setup(false);
    expect(screen.getByRole("button", { name: /Terminar/ })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(p.onTerminar).not.toHaveBeenCalled();
  });

  it("ignores shortcuts typed inside the form", () => {
    const p = setup();
    const form = document.createElement("div");
    form.setAttribute("data-places-form", "");
    const input = document.createElement("input");
    form.appendChild(input);
    document.body.appendChild(form);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(p.onDeshacer).not.toHaveBeenCalled();
    form.remove();
  });

  it("once finished, offers to keep drawing and ignores Enter/Esc", () => {
    const p = setup(false, true);
    expect(screen.queryByRole("button", { name: /Terminar/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Seguir dibujando/ }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(p.onSeguir).toHaveBeenCalledOnce();
    expect(p.onCancelar).not.toHaveBeenCalled();
    expect(p.onDeshacer).toHaveBeenCalledOnce();
  });

  it("Backspace does not undo once the polygon is finished", () => {
    const p = setup(false, true);
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(p.onDeshacer).not.toHaveBeenCalled();
  });
});

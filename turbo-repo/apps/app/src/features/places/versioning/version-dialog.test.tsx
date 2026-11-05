import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VersionDialog, { type VersionPendiente } from "./version-dialog";

const pendiente: VersionPendiente = {
  nombre: "Planta Norte",
  que: "la geocerca",
  actual: "1.2.0",
  cambios: [
    { texto: "Categorías: 1 agregada", bump: "MINOR" },
    { texto: "Nombre: «A» → «B»", bump: "PATCH" },
  ],
};

describe("VersionDialog", () => {
  it("lists the changes and starts on the recommended update", () => {
    render(
      <VersionDialog
        pendiente={pendiente}
        onCancelar={vi.fn()}
        onConfirmar={vi.fn()}
      />
    );
    // the changes, in their own scrollable list
    const lista = screen.getByRole("list", { name: "Cambios" });
    expect(lista).toHaveClass("max-h-40", "overflow-y-auto");
    expect(lista).toHaveTextContent("Categorías: 1 agregada");
    expect(lista).toHaveTextContent("Nombre: «A» → «B»");
    // the dropdown starts on the recommended update
    const tipo = screen.getByRole("button", { name: /Tipo de actualización/ });
    expect(tipo).toHaveTextContent("Menor");
    expect(tipo).toHaveTextContent("1.3.0");
    expect(tipo).toHaveTextContent("Recomendada");
  });

  it("needs a description and saves with the chosen update", () => {
    const onConfirmar = vi.fn();
    render(
      <VersionDialog
        pendiente={pendiente}
        onCancelar={vi.fn()}
        onConfirmar={onConfirmar}
      />
    );
    const guardar = () =>
      screen.getByRole("button", { name: /Guardar versión/ });
    expect(guardar()).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: /Tipo de actualización/ })
    );
    // the menu opens in a portal, above the modal's scrolling content
    const mayor = screen.getByRole("menuitem", { name: /Mayor/ });
    expect(mayor.closest('[role="dialog"]')).toBeNull();
    fireEvent.click(mayor);
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(guardar()).toHaveTextContent("Guardar versión 2.0.0");
    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "  Nueva bodega  " },
    });
    fireEvent.click(guardar());
    expect(onConfirmar).toHaveBeenCalledWith("MAJOR", "Nueva bodega");
  });

  it("opens as the blurred absolute modal and cancels with Escape", () => {
    const onCancelar = vi.fn();
    render(
      <VersionDialog
        pendiente={pendiente}
        onCancelar={onCancelar}
        onConfirmar={vi.fn()}
      />
    );
    const dialogo = screen.getByRole("dialog", {
      name: "Nueva versión de la geocerca «Planta Norte»",
    });
    expect(dialogo.parentElement).toHaveClass("backdrop-blur-[10px]");
    fireEvent.keyDown(dialogo, { key: "Escape" });
    expect(onCancelar).toHaveBeenCalled();
  });

  it("renders nothing without a pending version", () => {
    const { container } = render(
      <VersionDialog
        pendiente={null}
        onCancelar={vi.fn()}
        onConfirmar={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

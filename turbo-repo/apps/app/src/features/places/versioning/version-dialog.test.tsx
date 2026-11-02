import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VersionDialog, { type VersionPendiente } from "./version-dialog";
import { useVersionesPlaces } from "./versions-store";

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
    // Flowbite: the item's button (inside the menuitem) takes the click
    const mayor = screen.getByRole("menuitem", { name: /Mayor/ });
    fireEvent.click(within(mayor).getByRole("button"));
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

describe("places versions store", () => {
  beforeEach(() => globalThis.localStorage.clear());

  it("isolates history by account and organization, and refuses unscoped writes", () => {
    const { result, rerender } = renderHook(
      ({ scope }: { scope: string | null }) => useVersionesPlaces(scope),
      { initialProps: { scope: "demo-user-a:org-a" as string | null } }
    );
    act(() => {
      result.current.registrar("lugar", "demo-id", {
        version: "1.1.0",
        bump: "MINOR",
        descripcion: "Demo private change",
        cambios: [],
      });
    });
    rerender({ scope: "demo-user-a:org-b" });
    expect(result.current.historialDe("lugar", "demo-id")).toEqual([]);
    rerender({ scope: "demo-user-b:org-a" });
    expect(result.current.historialDe("lugar", "demo-id")).toEqual([]);
    rerender({ scope: null });
    act(() =>
      expect(
        result.current.registrar("lugar", "demo-id", {
          version: "2.0.0",
          bump: "MAJOR",
          descripcion: "Not saved",
          cambios: [],
        })
      ).toBe(false)
    );
    rerender({ scope: "demo-user-a:org-a" });
    expect(result.current.versionDe("lugar", "demo-id")).toBe("1.1.0");
  });

  it("starts at 1.0.0 and keeps each saved version in the history", () => {
    const { result } = renderHook(() => useVersionesPlaces("demo-user:org"));
    expect(result.current.versionDe("lugar", "p1")).toBe("1.0.0");
    expect(result.current.versionDe("lugar", null)).toBeNull();
    act(() => {
      result.current.registrar("lugar", "p1", {
        version: "1.1.0",
        bump: "MINOR",
        descripcion: "Nueva categoría",
        cambios: ["Categorías: 1 agregada"],
      });
    });
    expect(result.current.versionDe("lugar", "p1")).toBe("1.1.0");
    // trayectos keep their own history, even with the same id
    expect(result.current.versionDe("trayecto", "p1")).toBe("1.0.0");
    // and it is still there on the next visit
    const otra = renderHook(() => useVersionesPlaces("demo-user:org"));
    const [entrada] = otra.result.current.historialDe("lugar", "p1");
    expect(entrada).toMatchObject({
      version: "1.1.0",
      descripcion: "Nueva categoría",
    });
  });
});

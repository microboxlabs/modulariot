import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import PlaceForm from "./place-form";
import { FORM_VACIO, type FormLugar } from "../places.types";

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
vi.mock("../data/geocoding", () => ({
  buscarDirecciones: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        nombre: "Parque Araucano",
        contexto: "Las Condes",
        punto: [-33.4, -70.57],
      },
    ])
  ),
}));

function Harness({
  onUbicar,
  inicial = FORM_VACIO,
}: {
  onUbicar: () => void;
  inicial?: FormLugar;
}) {
  const [form, setForm] = useState<FormLugar>({ ...inicial });
  return (
    <PlaceForm
      form={form}
      setForm={setForm}
      cats={[]}
      guardando={false}
      msg={null}
      token="tok"
      cerca={() => null}
      onUbicar={onUbicar}
      onContinuar={() => undefined}
      onGuardar={() => undefined}
      onBack={() => undefined}
      onClose={() => undefined}
    />
  );
}

describe("PlaceForm", () => {
  it("keeps the position search in the form (it comes back with a draft)", () => {
    render(
      <Harness
        onUbicar={() => undefined}
        inicial={{
          ...FORM_VACIO,
          geom: "polygon",
          polyBase: "tri",
          busqueda: "Parque Araucano, Las Condes",
          ubicadoEn: "Parque Araucano, Las Condes",
        }}
      />
    );
    expect(screen.getByLabelText("Ubicar en el mapa")).toHaveValue(
      "Parque Araucano, Las Condes"
    );
    fireEvent.change(screen.getByLabelText("Ubicar en el mapa"), {
      target: { value: "otra" },
    });
    expect(screen.getByLabelText("Ubicar en el mapa")).toHaveValue("otra");
  });

  it("searches a place and moves the map to the suggestion", async () => {
    vi.useFakeTimers();
    const onUbicar = vi.fn();
    render(<Harness onUbicar={onUbicar} />);

    expect(screen.getByText("Posicionar geocerca")).toBeInTheDocument();
    const search = screen.getByLabelText("Ubicar en el mapa");
    const shapes = screen.getByRole("group", { name: "Forma de la geocerca" });
    expect(
      search.compareDocumentPosition(shapes) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Ubicar en el mapa"), {
      target: { value: "araucano" },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.mouseDown(screen.getByText("Parque Araucano"));

    expect(onUbicar).toHaveBeenCalledWith([-33.4, -70.57], FORM_VACIO.radius_m);
    expect(screen.getByLabelText("Ubicar en el mapa")).toHaveValue(
      "Parque Araucano, Las Condes"
    );
    expect(screen.queryByText(/En el mapa:/)).toBeNull();
    expect(screen.getByPlaceholderText("Ej: Planta Quilicura")).toHaveValue("");
    expect(screen.queryByText("Dirección")).toBeNull();
    expect(screen.queryByText("Geocercas interiores")).toBeNull();
    const crear = screen.getByRole("button", {
      name: "Guardar e interiores",
    });
    const salir = screen.getByRole("button", { name: "Guardar y salir" });
    expect(crear.parentElement).toBe(salir.parentElement);
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    vi.useRealTimers();
  });

  it("picks the geofence shape with icons", () => {
    render(<Harness onUbicar={() => undefined} />);
    const circulo = screen.getByRole("button", { name: "Círculo" });
    const poligono = screen.getByRole("button", { name: "Polígono" });
    const cuadrado = screen.getByRole("button", { name: "Cuadrado" });
    expect(circulo).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Radio")).toBeInTheDocument();
    expect(screen.getByLabelText("Radio")).toHaveValue(
      String(FORM_VACIO.radius_m)
    );
    fireEvent.mouseDown(screen.getByLabelText("Radio"), {
      button: 0,
      clientX: 100,
    });
    fireEvent.mouseMove(window, { clientX: 140 });
    expect(screen.getByLabelText("Radio")).toHaveValue("120");

    fireEvent.click(poligono);
    expect(poligono).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Ancho")).toBeNull();
    expect(
      screen.getByText(
        "Clic en el mapa para los vértices. Cierra la figura para crear geocerca."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Libre" })).toBeNull();

    fireEvent.click(cuadrado);
    expect(cuadrado).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Ancho")).toBeInTheDocument();
    expect(screen.getByLabelText("Alto")).toBeInTheDocument();
    expect(
      screen.getByText("Clic en el mapa para ubicar la forma")
    ).toBeInTheDocument();
    const vinculo = screen.getByRole("button", {
      name: "Vincular ancho y alto",
    });
    expect(vinculo).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Ancho"), {
      target: { value: "300" },
    });
    expect(screen.getByLabelText("Alto")).toHaveValue("300");

    fireEvent.click(vinculo);
    expect(vinculo).toHaveAttribute("aria-pressed", "false");
    expect(cuadrado).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Rectángulo" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Triángulo" }));
    expect(screen.getByRole("button", { name: "Triángulo" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("button", { name: "Vincular ancho y alto" })
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(poligono);
    expect(poligono).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Ancho")).toBeNull();
  });

  it("lets you pick the color of the main geofence", () => {
    render(<Harness onUbicar={() => undefined} />);
    const colorBtn = screen.getByTitle("Color de la geocerca");
    const iconBtn = screen.getByTitle("Elegir icono");
    expect(colorBtn).toHaveClass("aspect-square");
    expect(iconBtn).toHaveClass("aspect-square");
    fireEvent.click(screen.getByTitle("Color de la geocerca"));
    fireEvent.click(screen.getByTitle("Red"));
    fireEvent.click(screen.getByTitle("Color de la geocerca"));
    expect(screen.getByLabelText("HEX")).toHaveValue("EF4444");
  });

  it("close on the header exits without a cancel button", () => {
    const onClose = vi.fn();
    const onGuardar = vi.fn();
    render(
      <PlaceForm
        form={{ ...FORM_VACIO }}
        setForm={() => undefined}
        cats={[]}
        guardando={false}
        msg={null}
        onContinuar={() => undefined}
        onGuardar={onGuardar}
        onBack={() => undefined}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir" }));
    expect(onGuardar).toHaveBeenCalledTimes(1);
  });

  it("outlines missing name and location after a save attempt", () => {
    render(<Harness onUbicar={() => undefined} />);
    expect(screen.getByPlaceholderText("Ej: Planta Quilicura")).toHaveAttribute(
      "aria-invalid",
      "false"
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar e interiores" })
    );
    expect(screen.getByPlaceholderText("Ej: Planta Quilicura")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByLabelText("Ubicar en el mapa")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    fireEvent.change(screen.getByPlaceholderText("Ej: Planta Quilicura"), {
      target: { value: "Planta" },
    });
    expect(screen.getByPlaceholderText("Ej: Planta Quilicura")).toHaveAttribute(
      "aria-invalid",
      "false"
    );
    expect(screen.getByLabelText("Ubicar en el mapa")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.queryByText("Falta el nombre.")).toBeNull();
  });
});

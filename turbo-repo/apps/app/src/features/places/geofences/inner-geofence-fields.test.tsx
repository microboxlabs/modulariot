import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import PlaceForm from "./place-form";
import { FORM_VACIO, type FormLugar } from "../places.types";

const formBase: FormLugar = {
  ...FORM_VACIO,
  name: "Planta Quilicura",
  lat: -33.4,
  lon: -70.6,
  inners: [
    {
      id: "vip",
      name: "Lote VIP",
      geom: "circle",
      lat: -33.4,
      lon: -70.6,
      radius_m: 40,
      vertices: [],
      cerrado: false,
      color: "#1C64F2",
    },
    {
      id: "carga",
      name: "Zona carga",
      geom: "polygon",
      lat: null,
      lon: null,
      radius_m: 40,
      vertices: [
        [-33.4, -70.6],
        [-33.41, -70.6],
        [-33.41, -70.61],
      ],
      cerrado: true,
      color: "#0E9F6E",
    },
  ],
};

function Harness() {
  const [form, setForm] = useState<FormLugar>(formBase);
  return (
    <PlaceForm
      form={form}
      setForm={setForm}
      cats={[]}
      guardando={false}
      msg={null}
      paso="interiores"
      onContinuar={() => undefined}
      onGuardar={() => undefined}
      onBack={() => undefined}
      onClose={() => undefined}
    />
  );
}

describe("PlaceForm inner step", () => {
  it("lists inner geofences with search, add, back, and save-and-exit", () => {
    const onGuardar = vi.fn();
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(
      <PlaceForm
        form={formBase}
        setForm={() => undefined}
        cats={[]}
        guardando={false}
        msg={null}
        paso="interiores"
        onContinuar={() => undefined}
        onGuardar={onGuardar}
        onBack={onBack}
        onClose={onClose}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Interiores · Planta Quilicura" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Buscar geocerca interior" })
    ).toBeInTheDocument();
    expect(screen.getByText("Lote VIP")).toBeInTheDocument();
    expect(screen.getByText("Zona carga")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quitar Lote VIP")).toBeNull();
    expect(screen.queryByTitle("Color de la geocerca")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();

    const atras = screen.getByRole("button", { name: "Atrás" });
    const salir = screen.getByRole("button", { name: "Guardar y salir" });
    expect(atras.parentElement).toBe(salir.parentElement);
    fireEvent.click(atras);
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(salir);
    expect(onGuardar).toHaveBeenCalledTimes(1);
  });

  it("filters the inner list by name", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Buscar geocerca interior"), {
      target: { value: "vip" },
    });
    expect(screen.getByText("Lote VIP")).toBeInTheDocument();
    expect(screen.queryByText("Zona carga")).toBeNull();
  });

  it("adds an inner geofence from the bottom button", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar Geocerca Interior" })
    );
    expect(screen.getByPlaceholderText("Ej: Lote VIP")).toHaveValue("");
    expect(screen.getByLabelText("Radio")).toHaveValue("40");
    fireEvent.mouseDown(screen.getByLabelText("Radio"), {
      button: 0,
      clientX: 100,
    });
    fireEvent.mouseMove(window, { clientX: 140 });
    expect(screen.getByLabelText("Radio")).toHaveValue("140");
    expect(
      screen.getByLabelText("Quitar geocerca interior")
    ).toBeInTheDocument();
    expect(screen.getByTitle("Color de la geocerca")).toBeInTheDocument();
  });

  it("lets you define an inner square from the icon selector", () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar Geocerca Interior" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Cuadrado" }));
    expect(screen.getByLabelText("Ancho")).toBeInTheDocument();
    expect(screen.getByLabelText("Alto")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vincular ancho y alto" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Libre" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Triángulo" }));
    expect(screen.getByRole("button", { name: "Triángulo" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByRole("button", { name: "Rectángulo" })).toBeNull();
  });

  it("lets you pick the color of an inner geofence", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("Lote VIP"));
    expect(screen.getByPlaceholderText("Ej: Lote VIP")).toHaveValue("Lote VIP");
    expect(screen.getByLabelText("Quitar Lote VIP")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Color de la geocerca"));
    fireEvent.click(screen.getByTitle("Red"));
    fireEvent.click(screen.getByTitle("Color de la geocerca"));
    expect(screen.getByLabelText("HEX")).toHaveValue("EF4444");
  });
});

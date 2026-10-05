import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import AddressInput, { type Extremo } from "./address-input";
import type { Sugerencia } from "./geocoding";

vi.mock("./geocoding", () => ({
  buscarDirecciones: vi.fn(() =>
    Promise.resolve([
      { id: "1", nombre: "Calle Uno 10", contexto: "Maipú", punto: [1, 2] },
      { id: "2", nombre: "Calle Dos 20", contexto: "Ñuñoa", punto: [3, 4] },
    ])
  ),
}));

function Harness({ onElegir }: { onElegir: (s: Sugerencia) => void }) {
  const [v, setV] = useState<Extremo>({ texto: "", punto: null });
  return (
    <AddressInput
      label="Desde"
      letra="A"
      colorCls=""
      value={v}
      token="tok"
      cerca={() => null}
      onTexto={(texto) => setV({ texto, punto: null })}
      onElegir={(s) => {
        setV({ texto: s.nombre, punto: s.punto });
        onElegir(s);
      }}
    />
  );
}

async function escribir(texto: string) {
  fireEvent.change(screen.getByLabelText("Desde"), {
    target: { value: texto },
  });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

describe("AddressInput", () => {
  afterEach(() => vi.useRealTimers());

  it("suggests addresses after typing and picks one with the keyboard", async () => {
    vi.useFakeTimers();
    const onElegir = vi.fn();
    render(<Harness onElegir={onElegir} />);

    await escribir("calle");
    expect(screen.getByText("Calle Uno 10")).toBeInTheDocument();

    const input = screen.getByLabelText("Desde");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onElegir).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Calle Dos 20" })
    );
    expect(input).toHaveValue("Calle Dos 20");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("picks a suggestion with the mouse", async () => {
    vi.useFakeTimers();
    const onElegir = vi.fn();
    render(<Harness onElegir={onElegir} />);

    await escribir("calle");
    fireEvent.mouseDown(screen.getByText("Calle Uno 10"));

    expect(onElegir).toHaveBeenCalledWith(
      expect.objectContaining({ punto: [1, 2] })
    );
  });
});

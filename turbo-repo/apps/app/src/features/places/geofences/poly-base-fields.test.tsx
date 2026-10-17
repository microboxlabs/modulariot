import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RECT_MAX } from "./geofence-editor";
import PolyBaseFields, {
  acotarMetros,
  dxDelArrastre,
  milesConPunto,
  metrosDesdeTexto,
  valorDesdeArrastre,
} from "./poly-base-fields";

describe("milesConPunto", () => {
  it("groups thousands with a dot", () => {
    expect(milesConPunto(250)).toBe("250");
    expect(milesConPunto(1200)).toBe("1.200");
    expect(milesConPunto(1_000_000)).toBe("1.000.000");
    expect(metrosDesdeTexto("1.200")).toBe(1200);
    expect(metrosDesdeTexto("1200")).toBe(1200);
  });
});

describe("valorDesdeArrastre", () => {
  it("grows and shrinks in 10 m steps from horizontal drag", () => {
    expect(valorDesdeArrastre(200, 40)).toBe(300);
    expect(valorDesdeArrastre(200, -40)).toBe(100);
  });

  it("clamps to the allowed range", () => {
    expect(acotarMetros(0)).toBe(1);
    expect(acotarMetros(5)).toBe(5);
    expect(valorDesdeArrastre(200, 10_000)).toBe(25_200);
    expect(acotarMetros(9_999_999)).toBe(RECT_MAX);
    expect(acotarMetros(5, 50, 5000)).toBe(50);
  });
});

describe("PolyBaseFields drag", () => {
  it("scrubs the width when dragging on the number", () => {
    const onAncho = vi.fn();
    render(
      <PolyBaseFields
        anchoM={200}
        altoM={120}
        vinculado={false}
        onAncho={onAncho}
        onAlto={() => undefined}
        onVincular={() => undefined}
      />
    );
    const numero = screen.getByLabelText("Ancho");
    fireEvent.mouseDown(numero, { button: 0, clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 140 });
    expect(onAncho).toHaveBeenCalledWith(300);
  });

  it("keeps adding movement after the cursor hits the screen edge", () => {
    const a = { x: 100, dx: 4 };
    expect(dxDelArrastre(a, { clientX: 104, movementX: 36 }, true)).toBe(40);
    expect(dxDelArrastre(a, { clientX: 104, movementX: 40 }, true)).toBe(80);
    expect(valorDesdeArrastre(200, 80)).toBe(400);
  });

  it("shows thousands with a dot in the size field", () => {
    const onAncho = vi.fn();
    render(
      <PolyBaseFields
        anchoM={1200}
        altoM={5000}
        vinculado={false}
        onAncho={onAncho}
        onAlto={() => undefined}
        onVincular={() => undefined}
      />
    );
    expect(screen.getByLabelText("Ancho")).toHaveValue("1.200");
    expect(screen.getByLabelText("Alto")).toHaveValue("5.000");
    fireEvent.change(screen.getByLabelText("Ancho"), {
      target: { value: "1.500" },
    });
    expect(onAncho).toHaveBeenCalledWith(1500);
  });
});

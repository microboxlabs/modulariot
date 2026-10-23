import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SourceField } from "./maintainer-api";
import MeasureFields from "./measure-fields";

const d = {
  noMeasure: "Sin medida",
  measureRemove: "Quitar medida",
  measureName: "Nombre",
  measureSubtract: "− restar",
  editAsExpression: "Editar como expresión",
  conditionField: "Campo",
  searchField: "Buscar",
};

const FIELDS = [
  {
    path: "signal.frame.gps.speed",
    label: "Velocidad",
    type: "number",
    unit: "km/h",
    origin: null,
    engineSupported: true,
  },
] as SourceField[];

const renderIt = (expression: string | null, overrides = {}) => {
  const props = {
    onChange: vi.fn(),
    onEditAsExpression: vi.fn(),
    ...overrides,
  };
  render(
    <MeasureFields
      measure={
        expression ? { expression, label: "Velocidad", unit: "km/h" } : null
      }
      fields={FIELDS}
      readOnly={false}
      d={d}
      {...props}
    />
  );
  return props;
};

describe("MeasureFields", () => {
  it("offers a field when there is no measure", () => {
    renderIt(null);
    expect(screen.getByText("Sin medida")).toBeTruthy();
    expect(screen.getByLabelText("Campo")).toBeTruthy();
  });

  it("subtracts a number and removes the measure", () => {
    const { onChange } = renderIt("signal.frame.gps.speed");
    fireEvent.click(screen.getByText("− restar"));
    expect(onChange).toHaveBeenLastCalledWith({
      expression: "signal.frame.gps.speed - 0",
      label: "Velocidad − 0",
      unit: "km/h",
    });
    fireEvent.click(screen.getByText("Quitar medida"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("sends other expressions to the { } editor", () => {
    const { onEditAsExpression } = renderIt("signal.frame.gps.speed * 2");
    expect(screen.getByText("signal.frame.gps.speed * 2")).toBeTruthy();
    fireEvent.click(screen.getByText("Editar como expresión"));
    expect(onEditAsExpression).toHaveBeenCalled();
  });
});

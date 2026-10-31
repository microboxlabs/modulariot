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
    expect(screen.queryByText("Quitar medida")).toBeNull();
  });

  it("removes a missing measure that levels still compare", () => {
    const { onChange } = renderIt(null, { levelsUseMeasure: true });
    fireEvent.click(screen.getByText("Quitar medida"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("subtracts a number and removes the measure", () => {
    const { onChange } = renderIt("signal.frame.gps.speed");
    fireEvent.click(screen.getByText("− restar"));
    expect(onChange).toHaveBeenLastCalledWith({
      expression: "signal.frame.gps.speed - 0.0",
      label: "Velocidad − 0",
      unit: "km/h",
    });
    fireEvent.click(screen.getByText("Quitar medida"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("shows what is subtracted after the expression changes elsewhere", () => {
    const fields = [
      ...FIELDS,
      { ...FIELDS[0], path: "signal.road.limit", label: "Límite" },
    ] as SourceField[];
    const view = (expression: string) => (
      <MeasureFields
        measure={{ expression, label: null, unit: null }}
        fields={fields}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
        onEditAsExpression={vi.fn()}
      />
    );
    const { rerender } = render(
      view("signal.frame.gps.speed - signal.road.limit")
    );
    expect(screen.queryByLabelText("measureSubtractNumber")).toBeNull();
    rerender(view("signal.frame.gps.speed - 90"));
    const input = screen.getByLabelText("measureSubtractNumber");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("90");
    rerender(view("signal.frame.gps.speed - 80.0"));
    expect((input as HTMLInputElement).value).toBe("80");
  });

  it("sends other expressions to the { } editor", () => {
    const { onEditAsExpression } = renderIt("signal.frame.gps.speed * 2");
    expect(screen.getByText("signal.frame.gps.speed * 2")).toBeTruthy();
    fireEvent.click(screen.getByText("Editar como expresión"));
    expect(onEditAsExpression).toHaveBeenCalled();
  });
});

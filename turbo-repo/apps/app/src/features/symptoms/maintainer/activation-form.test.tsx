import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivationForm, { opLabel, useActivationForm } from "./activation-form";
import type { SourceField } from "./maintainer-api";

const field = (path: string, type: string): SourceField => ({
  path,
  label: path,
  type,
  unit: null,
  origin: null,
  engineSupported: true,
});

const FIELDS = [
  field("signal.trip.active", "bool"),
  field("signal.gps.speed_kmh", "number"),
];

describe("useActivationForm", () => {
  it("compiles form edits into the rule and keeps the rows it was given", () => {
    // The sheet stores the rule it is given and passes it back, as the draft does.
    let rule = "signal.trip.active";
    const onChange = vi.fn((next: string) => {
      rule = next;
    });
    const { result, rerender } = renderHook(() =>
      useActivationForm(rule, FIELDS, onChange)
    );
    const form = result.current.form;
    expect(form?.rows).toHaveLength(1);
    act(() => {
      result.current.update({
        ...form!,
        rows: [
          ...form!.rows,
          { id: "new", path: "signal.gps.speed_kmh", op: ">", value: 90 },
        ],
      });
    });
    rerender();
    expect(onChange).toHaveBeenCalledWith(
      "signal.trip.active && signal.gps.speed_kmh > 90"
    );
    expect(result.current.form?.rows.map((r) => r.id)).toContain("new");
  });

  it("reads the rule again when it changes elsewhere or when the fields arrive", () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ rule, fields }) => useActivationForm(rule, fields, onChange),
      {
        initialProps: {
          rule: "signal.gps.speed_kmh > 90",
          fields: [] as SourceField[],
        },
      }
    );
    expect(result.current.form).toBeNull();
    rerender({ rule: "signal.gps.speed_kmh > 90", fields: FIELDS });
    expect(result.current.form?.rows[0]).toMatchObject({ op: ">", value: 90 });
    rerender({
      rule: "signal.gps.speed_kmh > signal.trip.active",
      fields: FIELDS,
    });
    expect(result.current.form).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not report a change when the form compiles to the same rule", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useActivationForm("signal.trip.active", FIELDS, onChange)
    );
    act(() => result.current.update(result.current.form!));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("opLabel", () => {
  const d = {
    opIsTrue: "es verdadero",
    opIs: "es",
    opIsNot: "no es",
    opInside: "dentro",
    opOutside: "fuera",
  };
  it("reads by field type", () => {
    expect(opLabel(">=", "number", d)).toBe("≥");
    expect(opLabel("!=", "number", d)).toBe("≠");
    expect(opLabel("==", "zone", d)).toBe("dentro");
    expect(opLabel("!=", "list", d)).toBe("no es");
    expect(opLabel("is_true", "bool", d)).toBe("es verdadero");
    expect(opLabel(">=", "duration", d)).toBe("≥");
  });
});

describe("the number input", () => {
  const form = {
    match: "all" as const,
    rows: [
      { id: "r", path: "signal.gps.speed_kmh", op: ">" as const, value: 90 },
    ],
    groups: [],
  };
  const d = { conditionValue: "Valor" };

  it("keeps half-typed text while typing and restores the number on blur", () => {
    const onChange = vi.fn();
    render(
      <ActivationForm
        form={form}
        fields={FIELDS}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText("Valor") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-" } });
    expect(input.value).toBe("-");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input.value).toBe("90");
  });

  it("passes on a typed number", () => {
    const onChange = vi.fn();
    render(
      <ActivationForm
        form={form}
        fields={FIELDS}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "0.0000001" },
    });
    expect(onChange.mock.calls[0]?.[0].rows[0].value).toBe(1e-7);
  });
});

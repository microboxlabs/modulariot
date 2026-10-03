import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { type Mock, describe, expect, it, vi } from "vitest";
import ActivationForm, {
  NumberValue,
  opLabel,
  useActivationForm,
} from "./activation-form";
import type { Condition, ConditionForm } from "./condition-form";
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

describe("a number input that only accepts some numbers", () => {
  it("keeps a refused number as typed text and does not send it", () => {
    const onChange = vi.fn();
    render(
      <NumberValue
        value={30}
        unit="s"
        label="Segundos"
        readOnly={false}
        accept={(n) => n >= 0}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText("Segundos") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-1" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input.value).toBe("30");
    fireEvent.change(input, { target: { value: "45" } });
    expect(onChange).toHaveBeenCalledWith(45);
  });
});

describe("reordering conditions", () => {
  const d = { dragCondition: "Arrastra" };
  const row = (id: string, value: number): Condition => ({
    id,
    path: "signal.gps.speed_kmh",
    op: ">",
    value,
  });
  const FORM: ConditionForm = {
    match: "all",
    rows: [row("a", 1), row("b", 2), row("c", 3)],
    groups: [{ id: "g", match: "any", rows: [row("x", 8), row("y", 9)] }],
  };
  const sent = (onChange: Mock, call: number) =>
    onChange.mock.calls[call]?.[0] as ConditionForm | undefined;
  const ids = (rows: Condition[] | undefined) => rows?.map((r) => r.id);
  const transfer = () => ({
    dataTransfer: { setData: vi.fn(), setDragImage: vi.fn() },
  });
  const renderForm = (onChange: Mock) =>
    render(
      <ActivationForm
        form={FORM}
        fields={FIELDS}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );

  it("moves a row with the arrow keys on its handle", () => {
    const onChange = vi.fn();
    renderForm(onChange);
    const handles = screen.getAllByLabelText("Arrastra");
    expect(handles).toHaveLength(5);
    fireEvent.keyDown(handles[0]!, { key: "ArrowDown" });
    expect(ids(sent(onChange, 0)?.rows)).toEqual(["b", "a", "c"]);
    fireEvent.keyDown(handles[0]!, { key: "ArrowUp" });
    fireEvent.keyDown(handles[2]!, { key: "ArrowDown" });
    fireEvent.keyDown(handles[0]!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(handles[4]!, { key: "ArrowUp" });
    expect(ids(sent(onChange, 1)?.groups[0]?.rows)).toEqual(["y", "x"]);
  });

  it("keeps focus on a moved row's handle, and not after the next edit", () => {
    const d2 = { ...d, conditionValue: "Valor" };
    function Stateful() {
      const [form, setForm] = useState(FORM);
      return (
        <ActivationForm
          form={form}
          fields={FIELDS}
          readOnly={false}
          d={d2}
          onChange={setForm}
        />
      );
    }
    render(<Stateful />);
    screen.getAllByLabelText("Arrastra")[0]!.focus();
    fireEvent.keyDown(screen.getAllByLabelText("Arrastra")[0]!, {
      key: "ArrowDown",
    });
    const moved = screen.getAllByLabelText("Arrastra")[1]!;
    expect(document.activeElement).toBe(moved);
    expect(
      (screen.getAllByLabelText("Valor")[1] as HTMLInputElement).value
    ).toBe("1");

    const input = screen.getAllByLabelText("Valor")[2] as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "7" } });
    expect(document.activeElement).toBe(input);
  });

  it("moves a row dropped on another row of its list", () => {
    const onChange = vi.fn();
    renderForm(onChange);
    const handles = screen.getAllByLabelText("Arrastra");
    const rows = screen.getAllByTestId("condition-row");
    fireEvent.dragStart(handles[0]!, transfer());
    fireEvent.dragOver(rows[2]!);
    fireEvent.drop(rows[2]!);
    expect(ids(sent(onChange, 0)?.rows)).toEqual(["b", "c", "a"]);
  });

  it("does not take a row dropped from another list", () => {
    const onChange = vi.fn();
    renderForm(onChange);
    const handles = screen.getAllByLabelText("Arrastra");
    const rows = screen.getAllByTestId("condition-row");
    fireEvent.dragStart(handles[3]!, transfer());
    fireEvent.dragOver(rows[0]!);
    fireEvent.drop(rows[0]!);
    fireEvent.dragEnd(handles[3]!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("has no handle for readers or for a single condition", () => {
    const { rerender } = render(
      <ActivationForm
        form={FORM}
        fields={FIELDS}
        readOnly
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByLabelText("Arrastra")).toHaveLength(0);
    rerender(
      <ActivationForm
        form={{ match: "all", rows: [row("a", 1)], groups: [] }}
        fields={FIELDS}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByLabelText("Arrastra")).toHaveLength(0);
  });
});

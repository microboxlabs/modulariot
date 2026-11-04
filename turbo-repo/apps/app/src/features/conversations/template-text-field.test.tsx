import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TemplateTextField, { type Inserter } from "./template-text-field";

const VARS = [
  { name: "patente", label: "Patente del camión", type: "string" },
  { name: "conductor", label: "Nombre del conductor", type: "string" },
];

function Field({
  onValue,
  onFocusField,
}: Readonly<{
  onValue: (v: string) => void;
  onFocusField?: (insert: Inserter) => () => void;
}>) {
  const [value, setValue] = useState("");
  return (
    <TemplateTextField
      label="Texto"
      onFocusField={onFocusField}
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
      variables={VARS}
      known={null}
      d={{ insertVariable: "Variable" }}
    />
  );
}

describe("TemplateTextField", () => {
  it.each(["native flag", "composition events"])(
    "does not complete a variable while an IME commits text (%j)",
    (composition) => {
      const onValue = vi.fn();
      render(<Field onValue={onValue} />);
      const box = screen.getByLabelText("Texto");
      fireEvent.change(box, { target: { value: "Hola {{co" } });
      if (composition === "composition events") fireEvent.compositionStart(box);
      onValue.mockClear();
      fireEvent.keyDown(box, {
        key: "Enter",
        isComposing: composition === "native flag",
      });
      expect(onValue).not.toHaveBeenCalled();
      if (composition === "composition events") {
        fireEvent.compositionEnd(box);
        fireEvent.keyDown(box, { key: "Enter" });
        expect(onValue).toHaveBeenCalledWith("Hola {{conductor}}");
      }
    }
  );

  it("announces the option selected by the keyboard", () => {
    render(<Field onValue={vi.fn()} />);
    const box = screen.getByLabelText("Texto");
    fireEvent.change(box, { target: { value: "{{" } });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { selected: true }).id
    );
  });

  it("does not use a stale opening when the caret has moved", () => {
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);
    const box = screen.getByLabelText<HTMLTextAreaElement>("Texto");
    fireEvent.change(box, { target: { value: "Hola {{co" } });
    box.setSelectionRange(0, 0);
    onValue.mockClear();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onValue).not.toHaveBeenCalled();
    expect(box.value).toBe("Hola {{co");
  });

  it("closes completion after an external variables-panel insertion", () => {
    const onValue = vi.fn();
    let insert: Inserter = () => {};
    render(
      <Field
        onValue={onValue}
        onFocusField={(next) => {
          insert = next;
          return () => {};
        }}
      />
    );
    const box = screen.getByLabelText("Texto");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "Hola {{co" } });
    act(() => insert("{{patente}}"));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onValue).toHaveBeenLastCalledWith("Hola {{co{{patente}}");
  });

  it("offers the variables after {{ and writes the one picked with Enter", () => {
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);
    const box = screen.getByLabelText("Texto");

    fireEvent.change(box, { target: { value: "Hola {{co" } });
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "{{conductor}}Nombre del conductor",
    ]);

    fireEvent.keyDown(box, { key: "Enter" });
    expect(onValue).toHaveBeenLastCalledWith("Hola {{conductor}}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("uses the latest handler through an inserter retained after focus", () => {
    let insert: (text: string) => void = () => {};
    const register = (next: typeof insert) => {
      insert = next;
      return () => {};
    };
    const oldChange = vi.fn();
    const latestChange = vi.fn();
    const props = {
      label: "Texto",
      value: "",
      variables: VARS,
      known: null,
      d: {},
      onFocusField: register,
    };
    const view = render(<TemplateTextField {...props} onChange={oldChange} />);
    fireEvent.focus(screen.getByLabelText("Texto"));
    view.rerender(<TemplateTextField {...props} onChange={latestChange} />);
    insert("{{patente}}");
    expect(latestChange).toHaveBeenCalledWith("{{patente}}");
    expect(oldChange).not.toHaveBeenCalled();
  });

  it("closes the list with Escape and offers nothing outside {{", () => {
    render(<Field onValue={vi.fn()} />);
    const box = screen.getByLabelText("Texto");

    fireEvent.change(box, { target: { value: "Hola" } });
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.change(box, { target: { value: "Hola {{" } });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    const closeDrawer = vi.fn();
    document.addEventListener("keydown", closeDrawer);
    fireEvent.keyDown(box, { key: "Escape" });
    document.removeEventListener("keydown", closeDrawer);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(closeDrawer).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TemplateTextField from "./template-text-field";

const VARS = [
  { name: "patente", label: "Patente del camión", type: "string" },
  { name: "conductor", label: "Nombre del conductor", type: "string" },
];

function Field({ onValue }: Readonly<{ onValue: (v: string) => void }>) {
  const [value, setValue] = useState("");
  return (
    <TemplateTextField
      label="Texto"
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

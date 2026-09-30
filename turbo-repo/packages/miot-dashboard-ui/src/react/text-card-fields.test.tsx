// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TextCardFields } from "./text-card-fields";
afterEach(cleanup);
const labels = {
  legend: "Apariencia",
  text: "Texto",
  placeholder: "Escribe",
  alignment: "Alineación",
  left: "Izquierda",
  center: "Centro",
  right: "Derecha",
  italic: "Cursiva",
};
const value = { text: "Original", align: "left" as const, italic: true };
it("emits controlled changes without mutating the original draft", () => {
  const onChange = vi.fn();
  render(<TextCardFields value={value} labels={labels} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Texto"), {
    target: { value: "{{row.cost}}" },
  });
  expect(onChange).toHaveBeenLastCalledWith({ ...value, text: "{{row.cost}}" });
  fireEvent.change(screen.getByLabelText("Alineación"), {
    target: { value: "right" },
  });
  expect(onChange).toHaveBeenLastCalledWith({ ...value, align: "right" });
  fireEvent.click(screen.getByLabelText("Cursiva"));
  expect(onChange).toHaveBeenLastCalledWith({ ...value, italic: false });
  expect(value).toEqual({ text: "Original", align: "left", italic: true });
});
it("respects host draft reset and exposes validation text accessibly", () => {
  const onChange = vi.fn();
  const view = render(
    <TextCardFields
      value={{ ...value, text: "{{bad}}" }}
      labels={labels}
      onChange={onChange}
      textStatus="invalid"
      validationMessage="Revisa la plantilla"
    />,
  );
  const input = screen.getByLabelText("Texto") as HTMLTextAreaElement;
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(input.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe("Revisa la plantilla");
  view.rerender(
    <TextCardFields value={value} labels={labels} onChange={onChange} />,
  );
  expect(input.value).toBe("Original");
  expect(input.hasAttribute("aria-invalid")).toBe(false);
  expect(input.hasAttribute("aria-describedby")).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
});
it("isolates field IDs between simultaneous editors and suppresses disabled changes", () => {
  const onChange = vi.fn();
  render(
    <>
      <TextCardFields
        value={value}
        labels={labels}
        onChange={onChange}
        disabled
      />
      <TextCardFields value={value} labels={labels} onChange={onChange} />
    </>,
  );
  const inputs = screen.getAllByLabelText("Texto");
  expect(inputs[0]!.id).not.toBe(inputs[1]!.id);
  fireEvent.change(inputs[0]!, { target: { value: "forbidden" } });
  expect(onChange).not.toHaveBeenCalled();
  expect(inputs[0]!.closest("fieldset")?.disabled).toBe(true);
});

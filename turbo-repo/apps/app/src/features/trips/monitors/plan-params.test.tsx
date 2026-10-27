import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ParamsEditor } from "./plan-params";
vi.mock("@/features/i18n/tr.service", () => ({ tr: (key: string) => key }));
it("does not delete a parameter when its name collides with another row", () => {
  const onChange = vi.fn();
  render(
    <ParamsEditor
      params={{ limit: 10, limits: 20 }}
      onChange={onChange}
      readOnly={false}
      d={{}}
    />
  );
  fireEvent.change(screen.getAllByRole("textbox", { name: "paramName" })[1], {
    target: { value: "limit" },
  });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue("limits")).toBeInTheDocument();
});

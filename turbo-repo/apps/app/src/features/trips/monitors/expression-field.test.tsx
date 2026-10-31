import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ExpressionField from "./expression-field";
vi.mock("./monitors-api", () => ({
  useMonitorSchema: () => ({ data: [] }),
  checkExpression: vi.fn(),
}));
vi.mock("@/features/symptoms/maintainer/cel-editor", () => ({
  default: function Editor({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) {
    useEffect(() => {
      onChange(value);
    }, [value, onChange]);
    return (
      <input
        aria-label="expression"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  },
}));
it("ignores programmatic value synchronization but reports edits", () => {
  const onChange = vi.fn();
  const props = {
    label: "Condition",
    on: "plan" as const,
    expect: "condition" as const,
    params: {},
    onChange,
    readOnly: true,
  };
  const { rerender } = render(<ExpressionField {...props} value="true" />);
  rerender(<ExpressionField {...props} value="false" />);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "true" } });
  expect(onChange).toHaveBeenCalledWith("true");
});

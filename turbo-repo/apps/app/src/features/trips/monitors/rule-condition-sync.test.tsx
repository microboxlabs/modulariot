import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import RuleCondition from "./rule-condition";
vi.mock("./monitors-api", () => ({
  useMonitorSchema: () => ({ data: [] }),
  checkExpression: vi.fn(),
  STAGE_TYPES: [],
  TRIGGERS: [],
}));
vi.mock("@/features/symptoms/maintainer/cel-editor", () => ({
  default: function Editor({
    value,
    onChange,
  }: Readonly<{
    value: string;
    onChange: (value: string) => void;
  }>) {
    useEffect(() => {
      onChange(value);
    }, [value, onChange]);
    return (
      <input
        aria-label="condition"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  },
}));
it("restores an external condition without reporting a user edit", () => {
  const onChange = vi.fn();
  const props = {
    on: "plan" as const,
    params: {},
    mode: "expr" as const,
    readOnly: true,
    d: {},
    formDict: {},
    onChange,
    onMode: vi.fn(),
  };
  const { rerender } = render(<RuleCondition {...props} value="true" />);
  rerender(<RuleCondition {...props} value="false" />);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "true" } });
  expect(onChange).toHaveBeenCalledWith("true");
});

// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  within,
  cleanup,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import type { QueryPlanDraft } from "@microboxlabs/miot-dashboard-contract/authoring";
import { PlanSettings } from "./plan-settings";
import { DEFAULT_QUERY_WORKBENCH_LABELS as labels } from "./labels";
afterEach(cleanup);
function Settings() {
  const [draft, setDraft] = useState<QueryPlanDraft>({
    name: "Demo",
    projectId: "demo-project",
    location: "US",
    sql: "SELECT 1",
    maximumBytesBilled: 1000,
    parameters: [
      { name: "param_1", type: "STRING" },
      { name: "param_2", type: "STRING" },
    ],
  });
  return (
    <PlanSettings
      draft={draft}
      labels={labels}
      disabled={false}
      onChange={(change) => setDraft((current) => ({ ...current, ...change }))}
    />
  );
}
it("retains a remaining parameter's DOM identity and focus after removing an earlier row", () => {
  render(<Settings />);
  const group = within(screen.getByRole("group", { name: labels.parameters }));
  const remaining = group.getAllByLabelText(
    labels.parameterName,
  )[1] as HTMLInputElement;
  remaining.focus();
  fireEvent.click(
    screen.getByRole("button", { name: `${labels.removeParameter} @param_1` }),
  );
  expect(group.getAllByLabelText(labels.parameterName)[0]).toBe(remaining);
  expect(document.activeElement).toBe(remaining);
});
it("does not propose an existing parameter name after removing and adding a row", () => {
  render(<Settings />);
  fireEvent.click(
    screen.getByRole("button", { name: `${labels.removeParameter} @param_1` }),
  );
  fireEvent.click(screen.getByRole("button", { name: labels.addParameter }));
  const names = within(screen.getByRole("group", { name: labels.parameters }))
    .getAllByLabelText(labels.parameterName)
    .map((input) => (input as HTMLInputElement).value);
  expect(new Set(names).size).toBe(2);
});

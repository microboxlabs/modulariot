import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { Step } from "./maintainer-api";
import ScriptPanel, { scriptFields } from "./script-panel";

const samples = vi.hoisted(() => ({
  error: undefined as Error | undefined,
  retry: vi.fn(),
}));
beforeEach(() => {
  samples.error = undefined;
  vi.clearAllMocks();
});

vi.mock(
  "@/features/common/components/settings-drawer/settings-drawer-shell",
  () => ({
    SettingsDrawerShell: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  })
);
vi.mock("@/features/conversations/template-text-field", () => ({
  default: () => null,
}));
vi.mock("@/features/conversations/template-editor-parts", () => ({
  TemplateVariablesPanel: () => null,
}));
vi.mock("@/features/settings-admin/selectables/selectables-api", () => ({
  useSelectableOptions: () => ({ data: [] }),
}));
vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  useScriptSamples: () => ({
    data: undefined,
    error: samples.error,
    mutate: samples.retry,
  }),
}));

function Editor() {
  const [step, setStep] = useState<Step>({
    role: "Conductor",
    channel: "call",
    budgetMinutes: 1,
    script: "",
    replies: [
      { result: "answered", says: "Same answer" },
      { result: "answered", says: "Same answer" },
    ],
  });
  return (
    <ScriptPanel
      open
      index={0}
      step={step}
      readOnly={false}
      d={es.pages.userSettings.symptomCatalog}
      templateDict={es.pages.userSettings.communications}
      onChange={(patch) => setStep((current) => ({ ...current, ...patch }))}
      onClose={vi.fn()}
    />
  );
}

describe("script reply editing", () => {
  it("keeps standard trip fields alongside sparse sample data", () => {
    const fields = scriptFields(
      { case: { id: 1 }, condition: { extra: "value" }, trip: {}, vehicle: {} },
      es.pages.userSettings.symptomCatalog
    );
    expect(fields.map((field) => field.name)).toContain("trip.driver.name");
    expect(fields.map((field) => field.name)).toContain("condition.extra");
  });

  it("distinguishes a failed sample lookup from a symptom with no cases", () => {
    samples.error = new Error("unavailable");
    render(<Editor />);
    expect(screen.getByRole("alert").textContent).toContain(
      es.pages.userSettings.symptomCatalog.scriptSampleError
    );
    expect(
      screen.queryByText(es.pages.userSettings.symptomCatalog.scriptNoCases)
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: es.pages.userSettings.symptomCatalog.scriptRetrySamples,
      })
    );
    expect(samples.retry).toHaveBeenCalledOnce();
  });

  it("keeps the edited row focused when its text changes and an earlier duplicate row is removed", () => {
    render(<Editor />);
    const second = screen.getAllByRole("textbox", {
      name: es.pages.userSettings.symptomCatalog.scriptReplySays,
    })[1]!;
    second.focus();
    fireEvent.change(second, { target: { value: "Updated answer" } });
    expect(document.activeElement).toBe(second);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: es.pages.userSettings.symptomCatalog.scriptRemoveReply,
      })[0]!
    );
    expect(
      screen.getAllByRole("textbox", {
        name: es.pages.userSettings.symptomCatalog.scriptReplySays,
      })
    ).toEqual([second]);
    expect(document.activeElement).toBe(second);
  });
});

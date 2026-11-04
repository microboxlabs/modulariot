import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { Step } from "./maintainer-api";
import type { ScriptSample } from "@/features/symptoms/control-tower/control-tower-api";
import ScriptPanel, { scriptFields } from "./script-panel";

const samples = vi.hoisted(() => ({
  data: undefined as ScriptSample[] | undefined,
  error: undefined as Error | undefined,
  retry: vi.fn(),
}));
beforeEach(() => {
  samples.data = undefined;
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
vi.mock("@/features/conversations/template-editor-parts", () => ({
  TemplateVariablesPanel: () => null,
}));
vi.mock("@/features/settings-admin/selectables/selectables-api", () => ({
  useSelectableOptions: () => ({ data: [] }),
}));
vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  useScriptSamples: () => ({
    data: samples.data,
    error: samples.error,
    mutate: samples.retry,
  }),
}));

function Editor({ script = "" }: Readonly<{ script?: string }>) {
  const [step, setStep] = useState<Step>({
    role: "Conductor",
    channel: "call",
    budgetMinutes: 1,
    script,
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
  const caseSample = (id: number, driver: string): ScriptSample => ({
    symptom_id: id,
    asset_id: `CASE-${id}`,
    icu_code: 4,
    opened_at: "2026-11-03T18:52:00Z",
    context: {
      case: {},
      condition: {},
      vehicle: {},
      trip: { driver: { name: driver } },
    },
  });

  it("switches the filled preview to another case and keeps the message editable", () => {
    samples.data = [caseSample(1, "Ana"), caseSample(2, "Bea")];
    render(<Editor script="Hola {{trip.driver.name}}" />);
    expect(screen.getByText("Ana")).toBeTruthy();
    fireEvent.change(
      screen.getByLabelText(es.pages.userSettings.symptomCatalog.scriptSample),
      {
        target: { value: "1" },
      }
    );
    expect(screen.getByText("Bea")).toBeTruthy();
    const message = screen.getByLabelText<HTMLTextAreaElement>(
      es.pages.userSettings.symptomCatalog.stepScript
    );
    fireEvent.change(message, {
      target: { value: "Gracias {{trip.driver.name}}" },
    });
    expect(message.value).toBe("Gracias {{trip.driver.name}}");
    expect(screen.getByText("Bea")).toBeTruthy();
  });

  it("keeps the clamped sample after a refresh shrinks and restores the list", () => {
    const first = caseSample(1, "Ana");
    samples.data = [first, caseSample(2, "Bea")];
    const { rerender } = render(<Editor script="Hola {{trip.driver.name}}" />);
    const label = es.pages.userSettings.symptomCatalog.scriptSample;
    fireEvent.change(screen.getByLabelText(label), { target: { value: "1" } });
    samples.data = [first];
    rerender(<Editor script="Hola {{trip.driver.name}}" />);
    expect(screen.getByText("Ana")).toBeTruthy();
    samples.data = [first, caseSample(2, "Bea")];
    rerender(<Editor script="Hola {{trip.driver.name}}" />);
    expect(screen.getByLabelText<HTMLSelectElement>(label).value).toBe("0");
    expect(screen.getByText("Ana")).toBeTruthy();
  });

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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import en from "@/lang/en.json";

const PRESET_SPEC = {
  family: "trips",
  trigger: {
    event: "trip.milestone.confirmed",
    when: "event.data.milestone == 'departure'",
  },
  groups: [
    {
      id: "driver",
      name: "Conductor del viaje",
      entries: [{ contacts: "contact.nationalId == event.data.driver" }],
    },
  ],
  steps: [
    {
      after: 0,
      channel: "whatsapp",
      template: "miot_call_permission_request",
      to: ["driver"],
      waitForReply: 0,
    },
  ],
};

const api = vi.hoisted(() => ({
  createRule: vi.fn(),
  refreshRules: vi.fn(),
  useRulePresets: vi.fn<
    () => { data?: unknown; error?: unknown; mutate?: () => unknown }
  >(() => ({ data: undefined })),
  useEventCatalog: vi.fn(() => ({
    data: [
      {
        type: "symptom.case.opened",
        source: "symptoms",
        description: "",
        fields: [],
      },
      {
        type: "symptom.case.closed",
        source: "symptoms",
        description: "",
        fields: [],
      },
    ],
  })),
}));
vi.mock("./conversations-api", () => api);
vi.mock("./use-symptom-names", () => ({
  useSymptomNames: () => (key: string) =>
    key === "panic-button" ? "Botón de pánico" : undefined,
}));

import NewRuleModal, { newRuleHref, prefillFrom } from "./new-rule-modal";

const d = es.pages.userSettings.communications;
const WHEN = "event.data.symptomKey == 'panic-button' && event.data.level >= 4";

function open(prefill = {}, canWrite = true, dictionary = d) {
  const onCreated = vi.fn();
  render(
    <NewRuleModal
      open
      prefill={prefill}
      canWrite={canWrite}
      d={dictionary}
      onClose={vi.fn()}
      onCreated={onCreated}
    />
  );
  return onCreated;
}

const createButton = () =>
  screen.getByRole("button", { name: "Crear regla" }) as HTMLButtonElement;

describe("newRuleHref", () => {
  it("opens Comunicaciones with the modal and its prefill", () => {
    const href = newRuleHref("es", {
      event: "symptom.case.opened",
      when: WHEN,
      name: "Botón de pánico · Código negro",
    });
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/es/users/settings/communications");
    expect(prefillFrom(url.searchParams)).toEqual({
      event: "symptom.case.opened",
      when: WHEN,
      name: "Botón de pánico · Código negro",
    });
    expect(prefillFrom(new URLSearchParams("tab=activity"))).toBeNull();
  });
});

describe("NewRuleModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.useRulePresets.mockReturnValue({ data: undefined });
  });

  it("creates a preset's rule with the preset's spec", async () => {
    api.useRulePresets.mockReturnValue({
      data: [
        {
          key: "trip-departure-call-permission",
          name: "Salida del viaje → solicitar permiso de llamada al conductor",
          description: "Pide permiso al conductor.",
          spec: PRESET_SPEC,
        },
      ],
    });
    api.createRule.mockResolvedValue({ rule: { id: "r7" } });
    const onCreated = open();
    fireEvent.change(screen.getByLabelText("Partir de un preset"), {
      target: { value: "trip-departure-call-permission" },
    });
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe(
      "Salida del viaje → solicitar permiso de llamada al conductor"
    );
    expect(
      screen.getByText(d.rulePresetDeparturePermissionDescription)
    ).toBeTruthy();

    fireEvent.click(createButton());
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({ rule: { id: "r7" } })
    );
    expect(api.createRule).toHaveBeenCalledWith({
      key: "trip-departure-call-permission",
      name: "Salida del viaje → solicitar permiso de llamada al conductor",
      spec: PRESET_SPEC,
    });
    api.useRulePresets.mockReturnValue({ data: undefined });
  });

  it("creates the rule with the prefilled trigger and hands it back", async () => {
    api.createRule.mockResolvedValue({ rule: { id: "r9" } });
    const onCreated = open({
      event: "symptom.case.opened",
      when: WHEN,
      name: "Botón de pánico · Código negro",
    });
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe(
      "Botón de pánico · Código negro"
    );
    expect((screen.getByLabelText("Clave") as HTMLInputElement).value).toBe(
      "boton-de-panico-codigo-negro"
    );
    expect(
      screen.getByText(
        "Cuando se abre una condición de Botón de pánico en Código negro"
      )
    ).toBeTruthy();

    fireEvent.click(createButton());
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({ rule: { id: "r9" } })
    );
    expect(api.createRule).toHaveBeenCalledWith({
      key: "boton-de-panico-codigo-negro",
      name: "Botón de pánico · Código negro",
      spec: {
        trigger: { event: "symptom.case.opened", when: WHEN },
        groups: [{ id: "group-1", name: null, entries: [{ role: "driver" }] }],
        steps: [
          {
            after: 0,
            channel: "whatsapp",
            template: "",
            to: ["group-1"],
            waitForReply: 5,
            onReply: "stop",
          },
        ],
      },
    });
  });

  it("lets the event be picked, and drops a condition written for another event", async () => {
    api.createRule.mockResolvedValue({ rule: { id: "r1" } });
    open({ event: "symptom.case.opened", when: WHEN, name: "Cierre" });
    fireEvent.change(screen.getByLabelText("Evento"), {
      target: { value: "symptom.case.closed" },
    });
    fireEvent.click(createButton());
    await waitFor(() => expect(api.createRule).toHaveBeenCalled());
    expect(api.createRule.mock.calls[0][0].spec.trigger).toEqual({
      event: "symptom.case.closed",
      when: null,
    });
  });

  it("keeps a condition prefilled without an event, on the default event", async () => {
    api.createRule.mockResolvedValue({ rule: { id: "r2" } });
    open({ when: WHEN, name: "Pánico" });
    fireEvent.click(createButton());
    await waitFor(() => expect(api.createRule).toHaveBeenCalled());
    expect(api.createRule.mock.calls[0][0].spec.trigger).toEqual({
      event: "symptom.case.opened",
      when: WHEN,
    });
  });

  it("does not hand back a rule created after the modal was dismissed", async () => {
    let finish: (v: unknown) => void = () => {};
    api.createRule.mockReturnValue(new Promise((r) => (finish = r)));
    const onCreated = vi.fn();
    const { rerender } = render(
      <NewRuleModal
        open
        prefill={{ name: "Pánico" }}
        canWrite
        d={d}
        onClose={vi.fn()}
        onCreated={onCreated}
      />
    );
    fireEvent.click(createButton());
    rerender(
      <NewRuleModal
        open={false}
        prefill={{ name: "Pánico" }}
        canWrite
        d={d}
        onClose={vi.fn()}
        onCreated={onCreated}
      />
    );
    finish({ rule: { id: "r3" } });
    await waitFor(() => expect(api.refreshRules).toHaveBeenCalled());
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("needs a name and a valid key before it creates anything", () => {
    open();
    expect(createButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Pánico" },
    });
    expect(createButton().disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Clave"), {
      target: { value: "Mal Clave" },
    });
    expect(createButton().disabled).toBe(true);
  });

  it("says the key is taken when the API refuses it", async () => {
    const { ControlTowerError } =
      await import("@/features/symptoms/control-tower/control-tower-api");
    api.createRule.mockRejectedValue(new ControlTowerError("taken", 409));
    open({ name: "Pánico" });
    fireEvent.click(createButton());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Ya existe una regla con esa clave. Cambia la clave."
    );
  });

  it("lets only maintainers create a rule", () => {
    open({ name: "Pánico" }, false);
    expect(createButton().disabled).toBe(true);
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).disabled).toBe(
      true
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Solo quien mantiene la Torre de Control puede crear reglas."
    );
  });
  it("clears the preset identity when None is selected", () => {
    api.useRulePresets.mockReturnValue({
      data: [
        {
          key: "trip-departure-call-permission",
          name: "Original",
          description: "Original",
          spec: PRESET_SPEC,
        },
      ],
    });
    open({ name: "Mi regla" });
    fireEvent.change(screen.getByLabelText(d.rulePreset), {
      target: { value: "trip-departure-call-permission" },
    });
    fireEvent.change(screen.getByLabelText(d.rulePreset), {
      target: { value: "" },
    });
    expect(screen.getByLabelText(d.ruleName)).toHaveValue("Mi regla");
    expect(screen.getByLabelText(d.ruleKey)).not.toHaveValue(
      "trip-departure-call-permission"
    );
  });

  it("localizes the option, description and new rule name in English", async () => {
    const english = en.pages.userSettings.communications;
    api.useRulePresets.mockReturnValue({
      data: [
        {
          key: "trip-departure-call-permission",
          name: "Nombre español",
          description: "Descripción española",
          spec: PRESET_SPEC,
        },
      ],
    });
    api.createRule.mockResolvedValue({ rule: { id: "english" } });
    open({}, true, english);
    expect(
      screen.getByRole("option", {
        name: english.rulePresetDeparturePermissionName,
      })
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(english.rulePreset), {
      target: { value: "trip-departure-call-permission" },
    });
    expect(screen.getByLabelText(english.ruleName)).toHaveValue(
      english.rulePresetDeparturePermissionName
    );
    expect(
      screen.getByText(english.rulePresetDeparturePermissionDescription)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: english.createRule }));
    await waitFor(() =>
      expect(api.createRule).toHaveBeenCalledWith({
        key: "trip-departure-call-permission",
        name: english.rulePresetDeparturePermissionName,
        spec: PRESET_SPEC,
      })
    );
  });

  it("shows a preset load error with a retry", () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    api.useRulePresets.mockReturnValue({
      error: new Error("Synthetic invalid response"),
      mutate: retry,
    });
    open();
    expect(screen.getByRole("alert")).toHaveTextContent(
      d.rulePresetsLoadFailed
    );
    fireEvent.click(screen.getByRole("button", { name: d.retryRulePresets }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

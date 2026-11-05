import { describe, expect, it } from "vitest";
import es from "@/lang/es.json";
import type { RuleSpec } from "./conversations-types";
import {
  conditionValues,
  fillText,
  groupLabel,
  minutesAfter,
  newRuleSpec,
  normalizeSpec,
  parseWhen,
  ruleChanges,
  ruleTargets,
  sampleEvent,
  symptomLevelWhen,
  triggerSummary,
} from "./rule-model";

const d = es.pages.userSettings.communications;
const names = (key: string) => ({ "panic-button": "Botón de pánico" })[key];

describe("normalizeSpec", () => {
  it("uses the server's zero-minute default for a persisted step", () => {
    const saved = newRuleSpec();
    const step = { ...saved.steps[0] };
    delete (step as Partial<typeof step>).waitForReply;
    saved.steps = [step];
    expect(normalizeSpec(saved).steps[0].waitForReply).toBe(0);
    expect(newRuleSpec().steps[0].waitForReply).toBe(5);
  });
});

describe("triggerSummary", () => {
  it("names the symptom and the top level", () => {
    expect(
      triggerSummary(
        {
          event: "symptom.case.opened",
          when: "event.data.symptomKey == 'panic-button' && event.data.level >= 4",
        },
        d,
        names
      )
    ).toBe("Cuando se abre una condición de Botón de pánico en Código negro");
  });

  it("says 'o más' for a lower level and an exact level as is", () => {
    expect(
      triggerSummary(
        {
          event: "symptom.case.opened",
          when: 'event.data.level >= 3 && event.data.symptomKey == "speeding"',
        },
        d,
        names
      )
    ).toBe("Cuando se abre una condición de speeding en Crítica o más");
    expect(
      triggerSummary(
        {
          event: "symptom.case.level_changed",
          when: "(event.data.level == 2)",
        },
        d
      )
    ).toBe("Cuando una condición cambia de nivel en Comprometida");
  });

  it("reads level > n as the next level and tells other conditions apart", () => {
    expect(
      triggerSummary(
        {
          event: "symptom.case.opened",
          when: "event.data.level > 2 && event.test == false",
        },
        d
      )
    ).toBe(
      "Cuando se abre una condición en Crítica o más, si se cumplen las demás condiciones"
    );
  });

  it("keeps && inside quotes as part of one condition", () => {
    expect(
      parseWhen("event.data.symptomKey == 'a && b' && event.data.level >= 1")
    ).toEqual({
      symptomKey: "a && b",
      level: { op: ">=", value: 1 },
      others: 0,
    });
  });

  it("reads the conditions of a group in parentheses, and keeps an || group whole", () => {
    expect(
      parseWhen(
        "(event.data.symptomKey == 'panic-button' && event.data.level >= 4)"
      )
    ).toEqual({
      symptomKey: "panic-button",
      level: { op: ">=", value: 4 },
      others: 0,
    });
    expect(
      parseWhen("(event.data.level >= 4) || (event.data.level == 1)")
    ).toEqual({ symptomKey: null, level: null, others: 1 });
    expect(
      conditionValues("(event.data.assetId == 'X1' && event.data.level > 2)")
    ).toEqual({ assetId: "X1", level: 3 });
  });

  it("describes events it has no phrase for, and a missing trigger", () => {
    expect(
      triggerSummary({ event: "job.failed", when: null }, d, undefined, [
        {
          type: "job.failed",
          source: "jobs",
          description: "A job failed",
          fields: [],
        },
      ])
    ).toBe("Cuando llega «A job failed»");
    expect(triggerSummary(null, d)).toBe("Sin evento elegido");
  });
});

describe("ruleTargets", () => {
  const rule = (when: string, symptomKey?: string) => ({
    trigger: { event: "symptom.case.opened", when },
    symptomKey,
  });

  it("matches the symptom key and the levels the condition reaches", () => {
    const r = rule(symptomLevelWhen("panic-button", 3));
    expect(ruleTargets(r, "panic-button", 3)).toBe(true);
    expect(ruleTargets(r, "panic-button", 4)).toBe(true);
    expect(ruleTargets(r, "panic-button", 2)).toBe(false);
    expect(ruleTargets(r, "speeding", 4)).toBe(false);
  });

  it("takes the server's symptom key and any level when none is set", () => {
    expect(ruleTargets(rule("true", "panic-button"), "panic-button", 1)).toBe(
      true
    );
    expect(
      ruleTargets(
        { trigger: { event: "job.failed", when: null }, symptomKey: "x" },
        "x",
        1
      )
    ).toBe(false);
  });
});

describe("sampleEvent", () => {
  it("takes the condition's values, test defaults for the rest, and is not a test event", () => {
    const event = sampleEvent(
      {
        event: "symptom.case.opened",
        when: symptomLevelWhen("panic-button", 4),
      },
      {
        type: "symptom.case.opened",
        source: "miot-symptoms",
        description: "",
        contextKind: "symptom_case",
        fields: [
          { name: "symptomId", label: "Caso", type: "integer" },
          { name: "symptomKey", label: "Clave", type: "string" },
          { name: "symptomName", label: "Nombre", type: "string" },
          { name: "level", label: "Nivel", type: "integer" },
          { name: "assetId", label: "Vehículo", type: "string" },
          { name: "latitude", label: "Latitud", type: "number" },
          { name: "longitude", label: "Longitud", type: "number" },
          { name: "levelSince", label: "Desde", type: "date-time" },
        ],
      },
      new Date("2026-10-23T12:00:00Z")
    );
    expect(event).toEqual({
      type: "symptom.case.opened",
      context: { kind: "symptom_case", key: "1" },
      data: {
        symptomId: 1,
        symptomKey: "panic-button",
        symptomName: "",
        level: 4,
        assetId: "TEST01",
        latitude: -33.4489,
        longitude: -70.6693,
        levelSince: null,
      },
      test: false,
      at: "2026-10-23T12:00:00.000Z",
    });
  });

  it("reads ==, >= and > on any data field", () => {
    expect(
      conditionValues(
        'event.data.level > 2 && (event.data.assetId == "X1") && event.data.speedKmh >= 90 && event.data.manual == true && event.test == false'
      )
    ).toEqual({ level: 3, assetId: "X1", speedKmh: 90, manual: true });
  });

  it("counts minutes from the event for the timeline", () => {
    expect(minutesAfter("2026-10-23T12:05:00Z", "2026-10-23T12:00:00Z")).toBe(
      5
    );
    expect(minutesAfter(15, "x")).toBe(15);
    expect(minutesAfter("bad", "2026-10-23T12:00:00Z")).toBe(0);
  });
});

describe("ruleChanges", () => {
  const published: RuleSpec = newRuleSpec("symptom.case.opened", "true");

  it("is the first version before any publish", () => {
    expect(ruleChanges(published, null, d).map((c) => c.text)).toEqual([
      "Primera versión de la regla",
    ]);
  });

  it("lists each part that changed, ignoring spacing in the condition", () => {
    const draft: RuleSpec = {
      trigger: { event: "symptom.case.opened", when: "  true " },
      groups: [{ id: "group-1", entries: [{ role: "tower_lead" }] }],
      steps: [
        { ...published.steps[0], waitForReply: 10 },
        { ...published.steps[0], channel: "email" },
      ],
    };
    expect(ruleChanges(draft, published, d).map((c) => c.text)).toEqual([
      "A quién: otros destinatarios",
      "Paso 1 cambiado",
      "Paso 2 nuevo",
    ]);
  });

  it("counts spacing inside quotes as a change", () => {
    const before = newRuleSpec(
      "symptom.case.opened",
      "event.data.assetId == 'A  B'"
    );
    const after = newRuleSpec(
      "symptom.case.opened",
      "event.data.assetId  ==  'A B'"
    );
    const respaced = newRuleSpec(
      "symptom.case.opened",
      " event.data.assetId == 'A  B' "
    );
    expect(ruleChanges(after, before, d).map((c) => c.key)).toEqual(["when"]);
    expect(ruleChanges(respaced, before, d)).toEqual([]);
  });
});

describe("normalizeSpec", () => {
  it("reads a rule saved before groups as the server does", () => {
    const spec = normalizeSpec({
      trigger: { event: "symptom.case.opened" },
      audience: [{ role: "driver" }],
      steps: [
        { channel: "whatsapp", template: "a", to: "audience", waitForReply: 5 },
        {
          channel: "email",
          template: "b",
          to: [{ address: "tower@example.com", channel: "email" }],
        },
        { channel: "slack", connection: "c-1" },
      ],
    });
    expect(spec.groups).toEqual([
      { id: "rule", name: null, entries: [{ role: "driver" }] },
      {
        id: "step-2",
        name: null,
        entries: [{ address: "tower@example.com", channel: "email" }],
      },
    ]);
    expect(spec.steps.map((s) => s.to)).toEqual([["rule"], ["step-2"], []]);
    expect(spec.steps.map((s) => s.waitForReply)).toEqual([5, 0, 0]);
  });

  it("keeps a rule with groups as it is, with only group ids in a step", () => {
    const spec = normalizeSpec({
      groups: [{ id: "a", name: "A", entries: [{ role: "driver" }] }],
      steps: [{ channel: "whatsapp", template: "x", to: ["a", 3] }],
    });
    expect(spec.groups[0].name).toBe("A");
    expect(spec.steps[0].to).toEqual(["a"]);
  });

  it("names a group without a name by its place in the list", () => {
    expect(groupLabel({ id: "rule", entries: [] }, 0, d)).toBe("Grupo 1");
    expect(groupLabel({ id: "step-2", entries: [] }, 1, d)).toBe("Grupo 2");
    expect(groupLabel({ id: "group-7", entries: [] }, 2, d)).toBe("Grupo 3");
    expect(groupLabel({ id: "x", name: " Torre ", entries: [] }, 0, d)).toBe(
      "Torre"
    );
  });
});

describe("fillText", () => {
  it("fills known variables and keeps the unknown ones", () => {
    expect(
      fillText("Hola {{nombre}}, {{ patente }} {{x}}.", {
        nombre: "Ana",
        patente: "TEST01",
      })
    ).toEqual([
      { text: "Hola " },
      { variable: "nombre", value: "Ana" },
      { text: ", " },
      { variable: "patente", value: "TEST01" },
      { text: " " },
      { variable: "x", value: null },
      { text: "." },
    ]);
  });
});

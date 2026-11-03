import { describe, expect, it } from "vitest";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type {
  TowerAction,
  TowerTreatment,
} from "@/features/symptoms/control-tower/control-tower-api";
import type { Step } from "@/features/symptoms/maintainer/maintainer-api";
import {
  calledInCase,
  callPlan,
  fillScript,
  matchesTarget,
  stepAt,
} from "./call-plan";
import { type CallTarget, DRIVER_TARGET_ID } from "./call-targets";

const target = (id: string, role: string, name = id): CallTarget => ({
  id,
  contactId: id === DRIVER_TARGET_ID ? undefined : id,
  personName: name,
  role,
  phone: "",
  methods: [],
  stats: null,
});

const DRIVER = target(DRIVER_TARGET_ID, "Conductor", "Ana Pérez");
const TARGETS = [
  DRIVER,
  target("c1", "Transportista", "Luis"),
  target("c2", "Jefe de turno", "Marta"),
  target("c3", " transportista ", "Pedro"),
  target("c4", "Conductor", "Otro conductor"),
];

const step = (role: string | null): Step => ({
  role,
  channel: "call",
  budgetMinutes: 2,
  script: null,
});

const ids = (targets: CallTarget[]) => targets.map((t) => t.id);

describe("callPlan", () => {
  it("lists each step with the contacts of its role, in order", () => {
    const plan = callPlan([step("Conductor"), step("Transportista")], TARGETS);
    expect(plan.groups.map((g) => g.index)).toEqual([0, 1]);
    expect(ids(plan.groups[0]!.targets)).toEqual([DRIVER_TARGET_ID]);
    expect(ids(plan.groups[1]!.targets)).toEqual(["c1", "c3"]);
    expect(ids(plan.others)).toEqual(["c2", "c4"]);
  });

  it("leaves a step whose role nobody has empty", () => {
    const plan = callPlan([step("Supervisor"), step("")], TARGETS);
    expect(plan.groups[0]!.targets).toEqual([]);
    expect(plan.groups[1]!.targets).toEqual([]);
    expect(plan.others).toHaveLength(TARGETS.length);
  });

  it("puts everyone in the other contacts when there are no steps", () => {
    const plan = callPlan([], TARGETS);
    expect(plan.groups).toEqual([]);
    expect(ids(plan.others)).toEqual(ids(TARGETS));
  });

  it("moves contacts already called in the case to the end, oldest call first", () => {
    const called = new Map([
      ["c1", new Date("2026-11-03T10:05:00Z")],
      ["c3", new Date("2026-11-03T10:01:00Z")],
    ]);
    const plan = callPlan(
      [step("Transportista")],
      [...TARGETS, target("c5", "Transportista")],
      called
    );
    expect(ids(plan.groups[0]!.targets)).toEqual(["c5", "c3", "c1"]);
  });
});

const action = (patch: Partial<TowerAction>): TowerAction =>
  ({
    id: "a",
    kind: "CALL",
    contactId: null,
    contactRole: null,
    performedAt: "2026-11-03T10:00:00Z",
    ...patch,
  }) as TowerAction;

describe("calledInCase", () => {
  it("keeps the latest CALL per contact, and the driver by role", () => {
    const treatments = [
      {
        actions: [
          action({ contactId: "c1", performedAt: "2026-11-03T10:00:00Z" }),
          action({ contactId: "c1", performedAt: "2026-11-03T10:09:00Z" }),
          action({ contactRole: "Conductor" }),
          action({ kind: "NOTE", contactId: "c2" }),
        ],
      },
      {
        actions: [
          action({ contactId: "c1", performedAt: "2026-11-03T10:03:00Z" }),
        ],
      },
    ] as TowerTreatment[];
    const called = calledInCase(treatments);
    expect([...called.keys()].sort()).toEqual(["c1", DRIVER_TARGET_ID].sort());
    expect(called.get("c1")?.toISOString()).toBe("2026-11-03T10:09:00.000Z");
    expect(calledInCase(undefined).size).toBe(0);
  });
});

describe("matchesTarget", () => {
  it("matches name, role and phone digits", () => {
    const t = {
      ...target("c1", "Transportista", "Luis Soto"),
      phone: "+56 9 1234 5678",
    };
    expect(matchesTarget(t, "soto")).toBe(true);
    expect(matchesTarget(t, "transp")).toBe(true);
    expect(matchesTarget(t, "1234")).toBe(true);
    expect(matchesTarget(t, "Marta")).toBe(false);
    expect(matchesTarget(t, " ")).toBe(true);
  });
});

describe("fillScript", () => {
  it("fills the case's values and leaves unknown variables", () => {
    const treatment = {
      trip_info: {
        driver: "Ana Pérez",
        asset_id: "ABCD12",
        origin: "Planta",
        destination: "Puerto",
      },
    } as unknown as TreatmentsGeneralResponseItem;
    expect(
      fillScript(
        "Hola {{conductor}}, camión {{ patente }} en {{ruta}} a {{velocidad}}",
        treatment
      )
    ).toBe("Hola Ana Pérez, camión ABCD12 en Planta → Puerto a {{velocidad}}");
  });
});

describe("stepAt", () => {
  const steps = [
    { ...step("Conductor"), budgetMinutes: 1 },
    { ...step("Jefe"), budgetMinutes: 2 },
  ];

  it("follows the cumulative budget and stays on the last step", () => {
    expect(stepAt(steps, 0)).toBe(0);
    expect(stepAt(steps, 59)).toBe(0);
    expect(stepAt(steps, 60)).toBe(1);
    expect(stepAt(steps, 999)).toBe(1);
  });
});

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
  driverIds,
  stepAt,
  stepConditions,
} from "./call-plan";
import type { CallTarget } from "./call-targets";

const target = (
  id: string,
  role: string,
  name = id,
  companyRut: string | null = null
): CallTarget => ({
  id,
  contactId: id,
  personName: name,
  role,
  companyRut,
  phone: "",
  methods: [],
  stats: null,
});

const SUR = "000000030";
const TARGETS = [
  target("ana", "Conductor", "Ana", SUR),
  target("beto", "Conductor", "Beto", SUR),
  target("gs", "Gerente de Seguridad", "Gema", SUR),
  target("oc", "Oficina Comercial", "Omar", SUR),
  target("gs-norte", "Gerente de Seguridad", "Nora", "000000050"),
  target("torre", "Jefe de Torre", "Tomás"),
  target("torre2", " jefe de torre ", "Teresa"),
];
const step = (
  role: string | null,
  scope?: Step["scope"],
  who?: string
): Step => ({
  role,
  channel: "call",
  budgetMinutes: 2,
  script: null,
  scope,
  who,
});

const ids = (targets: CallTarget[]) => targets.map((t) => t.id);

describe("stepConditions", () => {
  it("sends each step's condition, reading older steps from their role and scope", () => {
    expect(
      stepConditions([
        step("Conductor"),
        step("Gerente de Seguridad", "TRIP_CARRIER"),
        step(null, null, "'vip' in contact.tags"),
      ])
    ).toEqual([
      "contact.roleKey == 'conductor' && ((has(event.data.driverRut) && has(event.data.driverIdType) && contact.nationalIdType == event.data.driverIdType && contact.nationalId == event.data.driverRut) || (has(event.data.secondDriverRut) && has(event.data.secondDriverIdType) && contact.nationalIdType == event.data.secondDriverIdType && contact.nationalId == event.data.secondDriverRut))",
      "contact.roleKey == 'gerente de seguridad' && contact.companyRut == event.data.carrierRut && has(event.data.carrierIdType) && contact.companyTaxIdType == event.data.carrierIdType",
      "'vip' in contact.tags",
    ]);
  });
});

describe("callPlan", () => {
  const steps = [
    step("Conductor", "DRIVER"),
    step("Gerente de Seguridad", "TRIP_CARRIER"),
  ];
  // What the server answered for each step's condition.
  const matches = [["ana", "beto"], ["gs"]];

  it("lists under each step the contacts the server matched, in step order", () => {
    const plan = callPlan(steps, TARGETS, new Map(), matches);
    expect(plan.groups.map((g) => [g.index, ids(g.targets)])).toEqual([
      [0, ["ana", "beto"]],
      [1, ["gs"]],
    ]);
    expect(plan.groups[0]!.summary).toEqual({
      role: "Conductor",
      driver: true,
      carrier: false,
      driverField: "either",
    });
    expect(ids(plan.others)).toEqual(["oc", "gs-norte", "torre", "torre2"]);
  });

  it("lists nobody under a step before the server answers, or for ids it does not know", () => {
    expect(
      callPlan(steps, TARGETS).groups.every((g) => g.targets.length === 0)
    ).toBe(true);
    expect(
      ids(
        callPlan([steps[0]!], TARGETS, new Map(), [["gone"]]).groups[0]!.targets
      )
    ).toEqual([]);
  });

  it("puts everyone in the other contacts when there are no steps", () => {
    const plan = callPlan([], TARGETS);
    expect(plan.groups).toEqual([]);
    expect(ids(plan.others)).toEqual(ids(TARGETS));
  });

  it("moves contacts already called in the case to the end, oldest call first", () => {
    const called = new Map([
      ["ana", new Date("2026-11-03T10:05:00Z")],
      ["gs", new Date("2026-11-03T10:01:00Z")],
    ]);
    const plan = callPlan([step("", "TRIP_CARRIER")], TARGETS, called, [
      ["ana", "beto", "gs", "oc"],
    ]);
    expect(ids(plan.groups[0]!.targets)).toEqual(["beto", "oc", "gs", "ana"]);
  });
});

describe("driverIds", () => {
  it("collects the people of the steps whose condition reads the driver's RUT", () => {
    expect([...driverIds(steps2(), [["ana", "beto"], ["gs"]])]).toEqual([
      "ana",
      "beto",
    ]);
  });
});

function steps2(): Step[] {
  return [step("Conductor"), step("Gerente", "TRIP_CARRIER")];
}

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
  it("keeps explicit contact calls and does not attribute a role-only call to current drivers", () => {
    const treatments = [
      {
        actions: [
          action({ contactId: "gs", performedAt: "2026-11-03T10:00:00Z" }),
          action({ contactId: "gs", performedAt: "2026-11-03T10:09:00Z" }),
          action({
            contactRole: "Conductor",
            performedAt: "2026-11-03T10:02:00Z",
          }),
          action({ kind: "NOTE", contactId: "oc" }),
        ],
      },
    ] as TowerTreatment[];
    const called = calledInCase(treatments);
    expect([...called.keys()].sort()).toEqual(["gs"]);
    expect(called.get("gs")?.toISOString()).toBe("2026-11-03T10:09:00.000Z");
    expect(calledInCase(treatments).has("ana")).toBe(false);
    expect(calledInCase(undefined).size).toBe(0);
  });
});

describe("matchesTarget", () => {
  it("matches name, role and phone digits", () => {
    const t = {
      ...target("c1", "Transportista", "Luis Soto"),
      phone: "+12025550101",
    };
    expect(matchesTarget(t, "soto")).toBe(true);
    expect(matchesTarget(t, "transp")).toBe(true);
    expect(matchesTarget(t, "5550")).toBe(true);
    expect(matchesTarget(t, "Marta")).toBe(false);
    expect(matchesTarget(t, " ")).toBe(true);
  });
});

describe("fillScript", () => {
  it("fills the case's values and leaves unknown variables", () => {
    const treatment = {
      trip_info: {
        driver: "Ana Pérez",
        asset_id: "TEST-PLATE",
        origin: "Planta",
        destination: "Puerto",
      },
    } as unknown as TreatmentsGeneralResponseItem;
    expect(
      fillScript(
        "Hola {{conductor}}, camión {{ patente }} en {{ruta}} a {{velocidad}}",
        treatment
      )
    ).toBe(
      "Hola Ana Pérez, camión TEST-PLATE en Planta → Puerto a {{velocidad}}"
    );
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

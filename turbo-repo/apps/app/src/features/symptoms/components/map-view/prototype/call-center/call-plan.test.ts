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
  tripMatches,
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

const SUR = "761112228";
const TARGETS = [
  target("ana", "Conductor", "Ana", SUR),
  target("beto", "Conductor", "Beto", SUR),
  target("gs", "Gerente de Seguridad", "Gema", SUR),
  target("oc", "Oficina Comercial", "Omar", SUR),
  target("gs-norte", "Gerente de Seguridad", "Nora", "769999999"),
  target("torre", "Jefe de Torre", "Tomás"),
  target("torre2", " jefe de torre ", "Teresa"),
];
// What the server found for the trip by RUT.
const TRIP = tripMatches({
  driverRuts: ["123456785", "98765432K"],
  carrierRut: SUR,
  drivers: ["ana", "beto"],
  carrierContacts: ["ana", "beto", "gs", "oc"],
});

const step = (role: string | null, scope?: Step["scope"]): Step => ({
  role,
  channel: "call",
  budgetMinutes: 2,
  script: null,
  scope,
});

const ids = (targets: CallTarget[]) => targets.map((t) => t.id);
const only = (s: Step, trip = TRIP) =>
  ids(callPlan([s], TARGETS, new Map(), trip).groups[0]!.targets);

describe("callPlan", () => {
  it("finds both trip drivers", () => {
    expect(only(step("Conductor", "DRIVER"))).toEqual(["ana", "beto"]);
  });

  it("finds the trip carrier's people with the step's role", () => {
    expect(only(step("Gerente de Seguridad", "TRIP_CARRIER"))).toEqual(["gs"]);
  });

  it("finds nobody when the carrier matches but the role does not", () => {
    expect(only(step("Jefe de Torre", "TRIP_CARRIER"))).toEqual([]);
  });

  it("finds any of the carrier's people when the role is empty", () => {
    expect(only(step("", "TRIP_CARRIER"))).toEqual(["ana", "beto", "gs", "oc"]);
  });

  it("finds the organization's own people with the role, not carrier people", () => {
    expect(only(step("Jefe de Torre", "ORG"))).toEqual(["torre", "torre2"]);
    expect(only(step("Gerente de Seguridad", "ORG"))).toEqual([]);
  });

  it("reads older steps without a scope", () => {
    expect(only(step("Conductor"))).toEqual(["ana", "beto"]);
    expect(only(step("Transportista"))).toEqual(["ana", "beto", "gs", "oc"]);
    expect(only(step("Jefe de Torre"))).toEqual(["torre", "torre2"]);
  });

  it("finds no trip people without the server's RUT matches", () => {
    expect(only(step("Conductor", "DRIVER"), tripMatches(undefined))).toEqual(
      []
    );
    expect(only(step("", "TRIP_CARRIER"), tripMatches(undefined))).toEqual([]);
  });

  it("keeps the step order and puts everyone else in the other contacts", () => {
    const plan = callPlan(
      [
        step("Conductor", "DRIVER"),
        step("Gerente de Seguridad", "TRIP_CARRIER"),
      ],
      TARGETS,
      new Map(),
      TRIP
    );
    expect(plan.groups.map((g) => [g.index, g.target?.scope])).toEqual([
      [0, "DRIVER"],
      [1, "TRIP_CARRIER"],
    ]);
    expect(ids(plan.others)).toEqual(["oc", "gs-norte", "torre", "torre2"]);
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
    const plan = callPlan([step("", "TRIP_CARRIER")], TARGETS, called, TRIP);
    expect(ids(plan.groups[0]!.targets)).toEqual(["beto", "oc", "gs", "ana"]);
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
  it("keeps the latest CALL per contact, and counts older driver calls for each trip driver", () => {
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
    const called = calledInCase(treatments, TRIP.drivers);
    expect([...called.keys()].sort()).toEqual(["ana", "beto", "gs"]);
    expect(called.get("gs")?.toISOString()).toBe("2026-11-03T10:09:00.000Z");
    expect(calledInCase(treatments).has("ana")).toBe(false);
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

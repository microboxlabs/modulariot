import { describe, expect, it } from "vitest";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type {
  TowerAction,
  TowerTreatment,
} from "@/features/symptoms/control-tower/control-tower-api";
import type { Step } from "@/features/symptoms/maintainer/maintainer-api";
import {
  calledInCase,
  callsInCase,
  withCaseCalls,
  skippedInCase,
  contextOfTreatment,
  callPlan,
  fillScript,
  matchesTarget,
  driverIds,
  emptyReason,
  stepAt,
  stepConditions,
} from "./call-plan";
import { summarizeWho } from "@/features/symptoms/control-tower/step-who";
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
      roles: ["Conductor"],
      driver: true,
      carrier: false,
      carrierSelf: false,
      company: null,
      tags: [],
      places: [],
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

describe("callsInCase", () => {
  const withPhone = (id: string, phone: string) => ({
    ...target(id, "Gerente"),
    phone,
  });

  it("counts answered and unanswered calls of this case's treatments only", () => {
    const caseA = [
      {
        actions: [
          action({ contactId: "gs", answered: true }),
          action({
            contactId: "gs",
            answered: false,
            performedAt: "2026-11-03T10:05:00Z",
          }),
          action({ contactId: "gs", answered: null, durationSeconds: 12 }),
          action({ kind: "NOTE", contactId: "gs" }),
        ],
      },
    ] as TowerTreatment[];
    const calls = callsInCase(caseA);
    expect(calls.get("gs")).toEqual({
      lastCallAt: new Date("2026-11-03T10:05:00Z"),
      accepted: 1,
      denied: 1,
    });
    // Case B has its own treatments: nobody was called there.
    expect(callsInCase([] as TowerTreatment[]).has("gs")).toBe(false);
  });

  it("matches an older call without a contact id by phone, never by role", () => {
    const targets = [
      withPhone("gs", "+56 9 1234 5678"),
      withPhone("oc", "+56 9 8765 4321"),
    ];
    const treatments = [
      {
        actions: [
          action({ contactPhone: "912345678", answered: false }),
          action({ contactRole: "Gerente" }),
        ],
      },
    ] as TowerTreatment[];
    const calls = callsInCase(treatments, targets);
    expect([...calls.keys()]).toEqual(["gs"]);
    expect(calls.get("gs")?.denied).toBe(1);
  });

  it("gives every target zero calls when the case has none", () => {
    const [t] = withCaseCalls(
      [
        {
          ...target("gs", "Gerente"),
          history: { lastCallAt: null, accepted: 2, denied: 1 },
        },
      ],
      new Map()
    );
    expect(t.stats).toEqual({ lastCallAt: null, accepted: 0, denied: 0 });
    expect(t.history?.accepted).toBe(2);
  });

  it("does not assign a phone-only call to contacts sharing the number", () => {
    const targets = [
      withPhone("gs", "+56 9 1234 5678"),
      withPhone("oc", "912345678"),
    ];
    const treatments = [
      { actions: [action({ contactPhone: "+56912345678" })] },
    ] as TowerTreatment[];
    expect(callsInCase(treatments, targets).size).toBe(0);
  });

  it("keeps country codes when matching numbers with the same last nine digits", () => {
    const targets = [
      withPhone("us", "+12025550101"),
      withPhone("gb", "+442025550101"),
    ];
    const treatments = [
      { actions: [action({ contactPhone: "+12025550101" })] },
    ] as TowerTreatment[];
    expect([...callsInCase(treatments, targets).keys()]).toEqual(["us"]);
  });

  it("uses a stable id even when contacts share a phone", () => {
    const targets = [
      withPhone("gs", "+56912345678"),
      withPhone("oc", "+56912345678"),
    ];
    const treatments = [
      { actions: [action({ contactId: "gs", contactPhone: "+56912345678" })] },
    ] as TowerTreatment[];
    expect([...callsInCase(treatments, targets).keys()]).toEqual(["gs"]);
  });

  it.each([0, 12])(
    "marks a pending call with duration %s as called without guessing its outcome",
    (durationSeconds) => {
      const treatments = [
        {
          actions: [
            action({
              contactId: "gs",
              answered: null,
              durationSeconds,
              details: { telephony: { status: "PENDING" } },
            }),
          ],
        },
      ] as TowerTreatment[];
      expect(callsInCase(treatments).get("gs")).toEqual({
        lastCallAt: new Date("2026-11-03T10:00:00Z"),
        accepted: 0,
        denied: 0,
      });
    }
  );
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
        contextOfTreatment(treatment)
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

describe("skippedInCase", () => {
  const note = (details: Record<string, unknown>, performedAt: string) =>
    ({
      kind: "NOTE",
      details,
      performedAt,
    }) as unknown as TowerAction;
  const episode = (...actions: TowerAction[]) =>
    ({ actions }) as unknown as TowerTreatment;
  const since = Date.parse("2026-11-05T12:00:00Z");

  it("returns the furthest step skipped since the SLA start, 0-based", () => {
    const treatments = [
      episode(note({ skipToStep: 2 }, "2026-11-05T12:01:00Z")),
      episode(note({ skipToStep: 3 }, "2026-11-05T12:02:00Z")),
    ];
    expect(skippedInCase(treatments, since)).toBe(2);
  });

  it("ignores skips from before the SLA start, plain notes and calls", () => {
    const treatments = [
      episode(
        note({ skipToStep: 3 }, "2026-11-05T11:59:00Z"),
        note({}, "2026-11-05T12:01:00Z"),
        note({ skipToStep: "2" }, "2026-11-05T12:01:00Z"),
        {
          kind: "CALL",
          details: { skipToStep: 2 },
          performedAt: "2026-11-05T12:01:00Z",
        } as unknown as TowerAction
      ),
    ];
    expect(skippedInCase(treatments, since)).toBeNull();
    expect(skippedInCase(undefined, since)).toBeNull();
  });

  it("counts every skip when the SLA start is unknown", () => {
    const treatments = [
      episode(note({ skipToStep: 2 }, "2026-11-05T11:00:00Z")),
    ];
    expect(skippedInCase(treatments, null)).toBe(1);
  });

  it("ignores a stale panel's skip saved after the current level or hold began", () => {
    const performedAt = "2026-11-05T12:01:00Z";
    expect(
      skippedInCase(
        [episode(note({ skipToStep: 3, level: 2 }, performedAt))],
        since,
        3
      )
    ).toBeNull();
    expect(
      skippedInCase(
        [
          episode(
            note(
              { skipToStep: 3, level: 3, slaSince: "2026-11-05T11:00:00Z" },
              performedAt
            )
          ),
        ],
        since,
        3
      )
    ).toBeNull();
    expect(
      skippedInCase(
        [
          episode(
            note(
              { skipToStep: 2, level: 3, slaSince: "2026-11-05T12:00:00Z" },
              performedAt
            )
          ),
        ],
        since,
        3
      )
    ).toBe(1);
  });
});

describe("emptyReason", () => {
  const group = (who: string) => ({ who, summary: summarizeWho(who) });
  const book = [{ role: "Transportista" }, { role: "Despachador" }];
  const CARRIER_SELF =
    "contact.role == 'Transportista' && contact.nationalId == event.data.carrierRut";

  it("says nobody has the role when no contact of the book has it", () => {
    expect(emptyReason(group("contact.role == 'Supervisor'"), book)).toEqual({
      kind: "noRole",
    });
    expect(
      emptyReason(group("contact.role == 'X' && foo(contact)"), book)
    ).toEqual({ kind: "noRole" });
  });

  it("says no contact with the role matches when some have it", () => {
    expect(emptyReason(group(CARRIER_SELF), book)).toEqual({
      kind: "noMatch",
      roles: ["Transportista"],
      trip: true,
    });
    expect(
      emptyReason(
        group("contact.role == ' transportista ' && contact.company == 'Uno'"),
        book
      )
    ).toEqual({ kind: "noMatch", roles: ["transportista"], trip: false });
  });

  it("shows the server's problem with the condition first", () => {
    expect(
      emptyReason(group(CARRIER_SELF), book, " undeclared field ")
    ).toEqual({
      kind: "problem",
      problem: "undeclared field",
    });
  });

  it("checks every accepted role, including later alternatives", () => {
    expect(
      emptyReason(
        group(
          "contact.role == 'Supervisor' || contact.role == 'Jefe de turno'"
        ),
        [{ role: "Jefe de turno" }]
      )
    ).toEqual({
      kind: "noMatch",
      roles: ["Supervisor", "Jefe de turno"],
      trip: false,
    });
  });

  it.each([
    "!(contact.role == 'Supervisor') && contact.company == 'Empresa Uno'",
    `contact.position == "contact.role == 'Supervisor'"`,
    "contact.role == 'Supervisor' || contact.position == 'Despachador'",
  ])("does not assert a missing role for %s", (who) => {
    expect(emptyReason(group(who), book).kind).toBe("noMatch");
  });

  it("does not confuse an event.data literal with a trip reference", () => {
    expect(
      emptyReason(
        group(
          "contact.role == 'Despachador' && contact.company == 'event.data analytics'"
        ),
        book
      )
    ).toEqual({
      kind: "noMatch",
      roles: ["Despachador"],
      trip: false,
    });
  });

  it("keeps the driver and carrier messages", () => {
    expect(
      emptyReason(group("contact.nationalId == event.data.driverRut"), [])
    ).toEqual({ kind: "driver" });
    expect(
      emptyReason(
        group(
          "contact.role == 'Gerente' && contact.companyRut == event.data.carrierRut"
        ),
        []
      )
    ).toEqual({ kind: "carrier", role: "Gerente" });
  });
});

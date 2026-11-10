import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mutate } from "swr";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import en from "@/lang/en.json";
import { ShowNotification } from "@/features/notifications/notification";
import CallCenterMenu from "./call-center-menu";

const data = vi.hoisted(() => ({
  contacts: [] as unknown[],
  treatments: undefined as unknown,
  /** Treatments per case id; wins over `treatments` when set. */
  treatmentsById: undefined as Record<string, unknown> | undefined,
  tripData: {} as Record<string, string>,
  /** The server's answer for one step condition. */
  match: (() => []) as (condition: string) => string[],
  /** The server's problem with one step condition. */
  problem: (() => null) as (condition: string) => string | null,
  level: undefined as unknown,
  levelError: undefined as { status: number } | undefined,
  tripError: undefined as Error | undefined,
  bookError: undefined as Error | undefined,
  tripLoading: false,
  refreshLevel: vi.fn(),
  treatmentsId: undefined as unknown,
  createContact: vi.fn(),
  updateContact: vi.fn(),
  refreshTrip: vi.fn(),
  context: undefined as unknown,
  permissions: [] as string[],
  openTreatment: vi.fn(),
  addTreatmentAction: vi.fn(),
  refreshTreatments: vi.fn(),
}));

// One object for every render; a new one per call re-renders without end.
const access = vi.hoisted(() => ({
  can: (permission: string) => data.permissions.includes(permission),
}));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  createContact: data.createContact,
  updateContact: data.updateContact,
  contactsKey: "contacts",
  contactFacetsKey: "contact-facets",
  revalidateCase: vi.fn(),
  useContacts: () => ({
    data: data.contacts,
    isLoading: false,
    error: data.bookError,
  }),
  useSymptomTreatments: (id: unknown) => {
    data.treatmentsId = id;
    const own = data.treatmentsById?.[String(id)];
    return { data: own ?? data.treatments, mutate: data.refreshTreatments };
  },
  openTreatment: data.openTreatment,
  addTreatmentAction: data.addTreatmentAction,
  useCaseContext: () => ({ data: data.context }),
  useTripContacts: (_id: unknown, conditions: string[]) => ({
    mutate: data.refreshTrip,
    isLoading: data.tripLoading,
    error: data.tripError,
    data: {
      data: data.tripData,
      matches: conditions.map((c) => data.match(c)),
      problems: conditions.map((c) => data.problem(c)),
    },
  }),
}));

vi.mock("@/features/conversations/conversations-api", () => ({
  contactReachKey: "contact-reach",
}));

vi.mock("swr", () => ({ mutate: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));

vi.mock("@/features/symptoms/maintainer/maintainer-api", () => ({
  useControlTowerAccess: () => access,
  useLevelResponse: () => ({
    data: data.level,
    error: data.levelError,
    mutate: data.refreshLevel,
  }),
}));

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));

const dict = es as unknown as I18nRecord;
const SUR = "000000030";

const contact = (
  id: string,
  name: string,
  role: string,
  patch: Record<string, unknown> = {}
) => ({
  id,
  name,
  role,
  company: null,
  companyRut: null,
  phone: "+12025550101",
  methods: ["PHONE"],
  active: true,
  lastCalledAt: null,
  answered: 2,
  missed: 1,
  ...patch,
});

const treatment = {
  symptom_info: { id: -7, name: "Exceso de velocidad", icu_code: 3 },
  trip_info: {
    // Shown in the case info; never used as a contact.
    driver: "Nombre en el viaje",
    driver_contact: "+12025550102",
    carrier: "Transportes Sur",
  },
} as unknown as TreatmentsGeneralResponseItem;

const levelWith = (steps: unknown[]) => ({
  version: 4,
  level: { response: { operator: true, slaMinutes: 10, steps } },
});

function renderMenu(treatmentData = treatment) {
  const onCall = vi.fn();
  render(
    <CallCenterMenu
      dict={dict}
      treatmentData={treatmentData}
      skippedTo={null}
      onSkip={vi.fn()}
      onCall={onCall}
    />
  );
  return onCall;
}

async function saveNewNumber(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  await user.click(screen.getByLabelText("Número de teléfono"));
  await user.paste("+12025550101");
  await user.type(screen.getByLabelText("Nombre"), name);
  await user.click(
    screen.getByRole("button", { name: "Llamar y guardar en la libreta" })
  );
}

beforeEach(() => {
  data.levelError = undefined;
  data.tripError = undefined;
  data.bookError = undefined;
  data.tripLoading = false;
  data.permissions = [];
  vi.clearAllMocks();
  data.contacts = [
    contact("ana", "Ana Pérez", "Conductor", {
      companyRut: SUR,
      methods: ["PHONE", "WHATSAPP"],
    }),
    contact("gs", "Gema Soto", "Gerente de Seguridad", { companyRut: SUR }),
    contact("gs-norte", "Nora Ruiz", "Gerente de Seguridad", {
      companyRut: "000000050",
    }),
    contact("torre", "Marta Díaz", "Jefe de Torre"),
    contact("off", "Inactivo", "Jefe de Torre", { active: false }),
  ];
  data.tripData = { driverRut: "000000019", carrierRut: SUR };
  // Stands in for the server's CEL evaluation of each step's condition.
  data.match = (c) => {
    if (c.includes("nationalId")) return ["ana"];
    if (c.toLowerCase().includes("gerente de seguridad")) return ["gs"];
    if (c.toLowerCase().includes("jefe de torre")) return ["torre"];
    return [];
  };
  data.problem = () => null;
  data.treatments = undefined;
  data.treatmentsById = undefined;
  data.level = undefined;
  data.context = undefined;
  data.createContact.mockImplementation(
    async (body: Record<string, unknown>) => ({ ...body, id: "new-contact" })
  );
});

describe("CallCenterMenu", () => {
  it.each(["call", "callAndSave"])(
    "keeps the due step script when a new number is used (%s)",
    async (action) => {
      data.contacts = [];
      data.level = levelWith([
        {
          role: "Conductor",
          channel: "call",
          budgetMinutes: 2,
          script: "Step message",
          goal: "Step goal",
        },
      ]);
      const user = userEvent.setup();
      const onCall = renderMenu();
      await user.click(screen.getByRole("button", { name: "Nuevo número" }));
      await user.click(screen.getByLabelText("Número de teléfono"));
      await user.paste("+12025550101");
      await user.type(screen.getByLabelText("Nombre"), "Synthetic contact");
      await user.click(
        screen.getByRole("button", {
          name:
            action === "call"
              ? es.symptoms.call_center_new_call_only
              : es.symptoms.call_center_new_call_and_save,
        })
      );
      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            message: "Step message",
            goal: "Step goal",
          })
        )
      );
    }
  );

  it("hands the step's script and goal, filled with the case, to the call", async () => {
    data.level = levelWith([
      {
        role: null,
        who: "contact.role == 'Conductor' && contact.nationalId == event.data.driverRut",
        channel: "call",
        budgetMinutes: 2,
        script: "Hola {{conductor}}, ¿dónde va el camión?",
        goal: "Saber dónde va {{patente}}",
      },
    ]);
    const user = userEvent.setup();
    const onCall = renderMenu();

    await user.click(screen.getByRole("button", { name: /Ana Pérez/ }));
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "ana" }),
      expect.objectContaining({
        message: "Hola Nombre en el viaje, ¿dónde va el camión?",
        goal: "Saber dónde va [patente]",
      })
    );
  });

  it("keeps separate contact channel addresses when selecting a target", async () => {
    data.contacts = [
      contact("synthetic", "Synthetic contact", "Dispatcher", {
        methods: ["PHONE", "WHATSAPP"],
        channels: { phone: "+12025550101", whatsapp: "+12025550102" },
      }),
    ];
    const onCall = renderMenu();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Synthetic contact/ }));
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: { phone: "+12025550101", whatsapp: "+12025550102" },
      })
    );
  });

  it("shows a goal even when the step has no message", () => {
    data.level = levelWith([
      {
        role: "Conductor",
        channel: "call",
        budgetMinutes: 2,
        goal: "Goal without a message",
      },
    ]);
    renderMenu();
    expect(screen.getByText(/Goal without a message/)).toBeTruthy();
  });

  it("keeps a newer call selection when an earlier contact save finishes", async () => {
    let finishSave = () => {};
    data.createContact.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () =>
            resolve(contact("new-contact", "Saved contact", ""));
        })
    );
    const user = userEvent.setup();
    const onCall = renderMenu();
    await user.click(screen.getByRole("button", { name: "Nuevo número" }));
    await user.click(screen.getByLabelText("Número de teléfono"));
    await user.paste("+12025550103");
    await user.type(screen.getByLabelText("Nombre"), "Saved contact");
    await user.click(
      screen.getByRole("button", { name: "Llamar y guardar en la libreta" })
    );
    await user.click(screen.getByRole("button", { name: /Gema/ }));
    await act(async () => finishSave());
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "gs" })
    );
  });

  it("shows no step budget or SLA when the case does not require an operator", () => {
    data.level = levelWith([
      { role: "Conductor", channel: "call", budgetMinutes: 2 },
    ]);
    renderMenu({
      ...treatment,
      symptom_info: {
        ...treatment.symptom_info,
        sla_since: new Date().toISOString(),
        sla_minutes: null,
      },
    });

    expect(document.querySelector('[aria-current="step"]')).toBeNull();
    expect(screen.queryByText(/SLA \d+:\d\d/)).toBeNull();
  });

  it("uses the case definition and version's steps instead of a same-name current response", () => {
    data.level = levelWith([
      {
        role: "Conductor",
        channel: "call",
        budgetMinutes: 1,
        goal: "Wrong version goal",
      },
    ]);
    renderMenu({
      ...treatment,
      symptom_info: {
        ...treatment.symptom_info,
        sla_since: new Date().toISOString(),
        sla_minutes: 5,
      },
      level_response: {
        definitionId: "demo-definition",
        name: treatment.symptom_info.name,
        version: "2.0.0",
        state: "ACTIVE",
        level: {
          icu: 3,
          applies: true,
          when: "true",
          response: {
            operator: true,
            slaMinutes: 5,
            steps: [
              {
                role: "Conductor",
                channel: "call",
                budgetMinutes: 5,
                goal: "Case version goal",
                script: null,
              },
            ],
            notices: [],
            evidence: [],
            ignorable: true,
          },
        },
      },
    });
    expect(screen.getByText(/Case version goal/)).toBeTruthy();
    expect(screen.queryByText(/Wrong version goal/)).toBeNull();
    expect(screen.getByText("v2.0.0")).toBeTruthy();
  });

  it("does not fall back to a different definition when the case has no published response", () => {
    data.level = levelWith([
      { role: "Conductor", channel: "call", budgetMinutes: 1 },
    ]);
    renderMenu({ ...treatment, level_response: null });
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it("uses the case SLA even when the current level has no operator", () => {
    data.level = {
      version: 5,
      level: {
        response: {
          operator: false,
          slaMinutes: null,
          steps: [{ role: "Conductor", channel: "call", budgetMinutes: 2 }],
        },
      },
    };
    renderMenu({
      ...treatment,
      symptom_info: {
        ...treatment.symptom_info,
        sla_since: new Date().toISOString(),
        sla_minutes: 5,
      },
    });

    expect(document.querySelector('[aria-current="step"]')).toBeTruthy();
    expect(screen.getByText(/SLA [45]:/)).toBeTruthy();
  });

  it("lists each step with the book contacts its condition matches", async () => {
    data.level = levelWith([
      {
        role: "Conductor",
        scope: "DRIVER",
        channel: "call",
        budgetMinutes: 2,
        script: null,
      },
      {
        role: "Gerente de Seguridad",
        scope: "TRIP_CARRIER",
        channel: "whatsapp",
        budgetMinutes: 3,
        script: null,
      },
      {
        role: "Jefe de Torre",
        channel: "call",
        budgetMinutes: 3,
        script: null,
      },
    ]);
    const user = userEvent.setup();
    const onCall = renderMenu({
      ...treatment,
      symptom_info: {
        ...treatment.symptom_info,
        sla_since: new Date().toISOString(),
      },
    });

    const due = document.querySelector('[aria-current="step"]') as HTMLElement;
    expect(within(due).getByText("Conductor del viaje")).toBeTruthy();
    expect(within(due).getByRole("button", { name: /Ana Pérez/ })).toBeTruthy();
    expect(within(due).getByLabelText("Llamada por WhatsApp")).toBeTruthy();

    expect(
      screen.getByText("Gerente de Seguridad · Transportes Sur")
    ).toBeTruthy();
    const gema = screen.getByRole("button", { name: /Gema Soto/ });
    expect(within(gema).getByText("No disponible por WhatsApp")).toBeTruthy();
    expect(screen.queryByText("Nora Ruiz")).toBeNull();

    // The step heading and the contact's role.
    expect(screen.getAllByText("Jefe de Torre")).toHaveLength(2);
    expect(screen.getByText("Marta Díaz")).toBeTruthy();
    expect(screen.queryByText("Inactivo")).toBeNull();
    expect(screen.getByText(/SLA \d+:\d\d/)).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Otros contactos (1)" })
    );
    expect(screen.getByText("Nora Ruiz")).toBeTruthy();

    await user.click(gema);
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "gs",
        role: "Gerente de Seguridad",
        phone: "+12025550101",
        methods: ["phone"],
        // Not called in this case; the book's counts stay apart as history.
        stats: { lastCallAt: null, accepted: 0, denied: 0 },
        history: expect.objectContaining({ accepted: 2, denied: 1 }),
      })
    );
  });

  it("says the trip driver is not in the book and adds them with the trip's RUT", async () => {
    data.match = () => [];
    data.level = levelWith([
      {
        role: "Conductor",
        scope: "DRIVER",
        channel: "call",
        budgetMinutes: 2,
        script: null,
      },
    ]);
    const user = userEvent.setup();
    const onCall = renderMenu();

    expect(
      screen.getByText("Conductor del viaje no está en la libreta.")
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Nuevo número" }));
    expect(
      screen.getByText("Se guarda como Conductor con RUT 000000019")
    ).toBeTruthy();
    await user.clear(
      screen.getByRole("textbox", { name: "Identificación del conductor" })
    );
    await user.type(
      screen.getByRole("textbox", { name: "Identificación del conductor" }),
      "000000027"
    );
    await saveNewNumber(user, "Ana Nueva");

    expect(data.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ana Nueva",
        role: "Conductor",
        nationalId: "000000027",
      })
    );
    expect(data.refreshTrip).toHaveBeenCalled();
    await waitFor(() =>
      expect(onCall).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "new-contact" })
      )
    );
  });

  describe("step titles and empty steps", () => {
    const CARRIER_SELF =
      "contact.role == 'Transportista' && contact.nationalId == event.data.carrierRut";
    const stepWho = (who: string) => ({
      role: null,
      who,
      channel: "call",
      budgetMinutes: 2,
      script: null,
    });
    const heading = (n: number) =>
      screen.getByText(String(n)).nextElementSibling as HTMLElement;

    it.each([
      [CARRIER_SELF, "Transportista · Transportes Sur"],
      ["contact.role == 'Supervisor'", "Supervisor"],
      [
        "contact.role == 'Supervisor' || contact.role == 'Jefe de turno'",
        "Supervisor o Jefe de turno",
      ],
      [
        "contact.company == 'Empresa Uno' && contact.role == 'Despachador'",
        "Despachador · Empresa Uno",
      ],
      [
        "contact.nationalId == event.data.secondDriverRut",
        "Segundo conductor del viaje",
      ],
      [
        "contact.role == 'CAT' && event.data.origin in contact.tags",
        "CAT del origen del viaje",
      ],
      [
        "contact.role == 'CAT' && event.data.destinationKey in contact.tagKeys",
        "CAT del destino del viaje",
      ],
      [
        "event.data.originKey in contact.tagKeys && event.data.destinationKey in contact.tagKeys",
        "Contactos del origen y destino del viaje",
      ],
      [
        "contact.role == 'Supervisor' && contact.position.startsWith('x')",
        "Supervisor",
      ],
      [
        "contact.position == 'x' || contact.companyRut == event.data.otherRut",
        "Contactos que cumplen la condición",
      ],
    ])("titles %s without CEL and keeps it in the tooltip", (who, title) => {
      data.match = () => [];
      data.level = levelWith([stepWho(who)]);
      renderMenu();
      const el = heading(1);
      expect(el.textContent).toBe(title);
      expect(el.textContent).not.toMatch(/contact\.|event\./);
      expect(el.getAttribute("title")).toBe(who);
    });

    it("says nobody has the role when no contact of the book has it", () => {
      data.contacts = [contact("t1", "Contacto Uno", "Despachador")];
      data.level = levelWith([stepWho(CARRIER_SELF)]);
      renderMenu();
      expect(
        screen.getByText("Nadie en la libreta tiene este rol.")
      ).toBeTruthy();
    });

    it("says no contact with the role belongs to the trip, and pre-fills a new one", async () => {
      data.contacts = [
        contact("t1", "Contacto Uno", "Transportista"),
        contact("t2", "Contacto Dos", "transportista"),
      ];
      data.match = () => [];
      data.level = levelWith([stepWho(CARRIER_SELF)]);
      data.permissions = ["controltower:contact.write"];
      const user = userEvent.setup();
      renderMenu();
      expect(
        screen.getByText(
          "Ningún Transportista de la libreta corresponde a este viaje."
        )
      ).toBeTruthy();
      expect(
        screen.queryByText("Nadie en la libreta tiene este rol.")
      ).toBeNull();

      await user.click(screen.getByRole("button", { name: "Nuevo número" }));
      await saveNewNumber(user, "Contacto Nuevo");
      expect(data.createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "Transportista",
          nationalId: SUR,
          companyRut: SUR,
          company: "Transportes Sur",
        })
      );
    });

    it("pre-fills a new contact of the origin's role with the trip's origin as a tag", async () => {
      data.contacts = [contact("t1", "Contacto Uno", "CAT")];
      data.match = () => [];
      data.tripData = { origin: "Planta Norte", originKey: "planta norte" };
      data.level = levelWith([
        stepWho(
          "contact.role == 'CAT' && event.data.originKey in contact.tagKeys"
        ),
      ]);
      data.permissions = ["controltower:contact.write"];
      const user = userEvent.setup();
      renderMenu();
      expect(
        screen.getByText("Ningún CAT de la libreta corresponde a este viaje.")
      ).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Nuevo número" }));
      await saveNewNumber(user, "Contacto Nuevo");
      expect(data.createContact).toHaveBeenCalledWith(
        expect.objectContaining({ role: "CAT", tags: ["Planta Norte"] })
      );
    });

    it("shows the server's problem with the condition and offers no new contact", () => {
      data.contacts = [contact("t1", "Contacto Uno", "Transportista")];
      data.problem = () => "undeclared reference to 'foo'";
      data.level = levelWith([
        stepWho("contact.role == 'Transportista' && foo"),
      ]);
      renderMenu();
      expect(
        screen.getByText(
          "La condición del paso tiene un problema: undeclared reference to 'foo'"
        )
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Nuevo número" })).toBeNull();
    });

    it.each([
      [
        "contact.role == 'Supervisor' && contact.nationalId == event.data.secondDriverRut",
        { secondDriverRut: "000000027" },
        { role: "Supervisor", nationalId: "000000027", nationalIdType: "RUT" },
      ],
      [
        "contact.role == 'Despachador' && contact.companyRut == event.data.carrierRut && contact.company == 'Empresa Uno'",
        {},
        { role: "Despachador", companyRut: SUR, company: "Empresa Uno" },
      ],
      [
        "contact.role == 'Supervisor' && 'night' in contact.tags",
        {},
        { role: "Supervisor", tags: ["night"] },
      ],
      [
        "contact.role == 'Supervisor' && contact.position.startsWith('x')",
        {},
        { role: "Supervisor" },
      ],
      [
        CARRIER_SELF,
        { carrierRut: "20123456789" },
        {
          role: "Transportista",
          nationalId: "20123456789",
          nationalIdType: "OTRO",
          companyTaxIdType: "RUC",
        },
      ],
      [
        "contact.nationalId == event.data.driverRut",
        { carrierRut: "20123456789" },
        { role: "Conductor", nationalId: "000000019", nationalIdType: "DNI" },
      ],
    ])(
      "preserves the empty step preset when saving %s",
      async (who, trip, expected) => {
        data.match = () => [];
        data.tripData = { ...data.tripData, ...trip };
        data.level = levelWith([stepWho(who)]);
        data.permissions = ["controltower:contact.write"];
        const user = userEvent.setup();
        renderMenu();
        await user.click(screen.getByRole("button", { name: "Nuevo número" }));
        await saveNewNumber(user, "Contacto Nuevo");
        await waitFor(() =>
          expect(data.createContact).toHaveBeenCalledWith(
            expect.objectContaining(expected)
          )
        );
      }
    );

    it.each([
      "!(contact.role == 'Supervisor') && contact.company == 'Empresa Uno'",
      "contact.role == 'Supervisor' || contact.position == 'x'",
    ])("does not prefill an excluded or optional role: %s", (who) => {
      data.permissions = ["controltower:contact.write"];
      data.match = () => [];
      data.level = levelWith([stepWho(who)]);
      renderMenu();
      expect(screen.queryByRole("button", { name: "Nuevo número" })).toBeNull();
    });

    it.each([
      [
        "contact.role == 'Supervisor' || contact.role == 'Jefe de turno'",
        "Supervisor or Jefe de turno",
        "Nobody in the contact book has this role.",
        null,
      ],
      [
        CARRIER_SELF,
        "Transportista · Transportes Sur",
        "No Transportista in the contact book belongs to this trip.",
        null,
      ],
      [
        "contact.role == 'Transportista' && foo",
        "Transportista",
        "The step condition has a problem: undeclared reference",
        "undeclared reference",
      ],
    ])(
      "renders English titles and empty states: %s",
      (who, title, message, problem) => {
        data.match = () => [];
        data.contacts = [contact("carrier", "Carrier", "Transportista")];
        data.problem = () => problem;
        data.level = levelWith([stepWho(who)]);
        render(
          <CallCenterMenu
            dict={en as unknown as I18nRecord}
            treatmentData={treatment}
            skippedTo={null}
            onSkip={vi.fn()}
            onCall={vi.fn()}
          />
        );
        expect(heading(1).textContent).toBe(title);
        expect(screen.getByText(message)).toBeTruthy();
      }
    );
  });

  it("names the missing carrier role and pre-fills it with the company RUT", async () => {
    data.level = levelWith([
      {
        role: "Oficina Comercial",
        scope: "TRIP_CARRIER",
        channel: "call",
        budgetMinutes: 2,
        script: null,
      },
    ]);
    const user = userEvent.setup();
    renderMenu();

    expect(
      screen.getByText(
        "Oficina Comercial del transportista del viaje no está en la libreta."
      )
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Nuevo número" }));
    expect(
      screen.getByText(
        "Se guarda como Oficina Comercial de la empresa con RUT 000000030"
      )
    ).toBeTruthy();
    await saveNewNumber(user, "Omar");
    expect(data.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "Oficina Comercial",
        companyRut: SUR,
        company: "Transportes Sur",
      })
    );
  });

  it("pre-fills a trip RUT with dash in the book's form", async () => {
    data.match = () => [];
    data.tripData = { driverRut: "11.111.111-1", carrierRut: "22222222-2" };
    data.level = levelWith([
      {
        role: "Conductor",
        scope: "DRIVER",
        channel: "call",
        budgetMinutes: 2,
        script: null,
      },
    ]);
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Nuevo número" }));
    expect(
      screen.getByText("Se guarda como Conductor con RUT 111111111")
    ).toBeTruthy();
  });

  it("pre-fills a carrier RUT with dash in the book's form", async () => {
    data.tripData = { driverRut: "000000019", carrierRut: "22.222.222-2" };
    data.level = levelWith([
      {
        role: "Oficina Comercial",
        scope: "TRIP_CARRIER",
        channel: "call",
        budgetMinutes: 2,
        script: null,
      },
    ]);
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Nuevo número" }));
    expect(
      screen.getByText(
        "Se guarda como Oficina Comercial de la empresa con RUT 222222222"
      )
    ).toBeTruthy();
    await saveNewNumber(user, "Omar");
    expect(data.createContact).toHaveBeenCalledWith(
      expect.objectContaining({ companyRut: "222222222" })
    );
  });

  it("marks a contact already called in this case by contact id", () => {
    data.level = levelWith([
      { role: "Conductor", channel: "call", budgetMinutes: 2, script: null },
    ]);
    data.treatments = [
      {
        actions: [
          {
            kind: "CALL",
            contactId: "ana",
            contactRole: "Conductor",
            performedAt: new Date().toISOString(),
          },
        ],
      },
    ];
    renderMenu();
    expect(data.treatmentsId).toBe(-7);
    expect(screen.getByText(es.symptoms.call_center_just_called)).toBeTruthy();
  });

  describe("calls in this case", () => {
    const callAction = (patch: Record<string, unknown>) => ({
      kind: "CALL",
      contactId: null,
      contactPhone: null,
      contactRole: null,
      answered: true,
      durationSeconds: 30,
      performedAt: new Date().toISOString(),
      ...patch,
    });
    const caseB = {
      ...treatment,
      symptom_info: { ...treatment.symptom_info, id: -8 },
    } as unknown as TreatmentsGeneralResponseItem;
    const anaRow = () => screen.getByRole("button", { name: /Ana Pérez/ });
    const counters = (row: HTMLElement) =>
      within(row).getByTitle(/En este caso/);

    beforeEach(() => {
      data.level = levelWith([
        { role: "Conductor", channel: "call", budgetMinutes: 2, script: null },
      ]);
      // Ana was called in case -7 only.
      data.treatmentsById = {
        "-7": [
          {
            actions: [
              callAction({ contactId: "ana" }),
              callAction({
                contactId: "ana",
                answered: false,
                durationSeconds: 0,
              }),
            ],
          },
        ],
        "-8": [],
      };
    });

    it("does not show a contact called in another case as called", () => {
      renderMenu(caseB);
      expect(data.treatmentsId).toBe(-8);
      expect(
        screen.queryByText(es.symptoms.call_center_just_called)
      ).toBeNull();
      const badges = counters(anaRow());
      expect(badges.textContent).toBe("00");
      // The book's history is labelled as all cases, apart from this case.
      expect(badges.getAttribute("title")).toBe(
        "En este caso: contestadas 0, sin respuesta 0\n" +
          "En todos los casos: contestadas 2, sin respuesta 1"
      );
    });

    it("shows a contact called in this case as called, with this case's counts", () => {
      renderMenu();
      expect(data.treatmentsId).toBe(-7);
      expect(
        within(anaRow()).getByText(es.symptoms.call_center_just_called)
      ).toBeTruthy();
      const badges = counters(anaRow());
      expect(badges.textContent).toBe("11");
      expect(badges.getAttribute("title")).toMatch(
        /^En este caso: contestadas 1, sin respuesta 1\n/
      );
    });

    it("matches an older call without a contact id by phone", () => {
      data.treatmentsById = {
        "-7": [{ actions: [callAction({ contactPhone: "+1 202 555 0101" })] }],
      };
      data.contacts = [
        contact("ana", "Ana Pérez", "Conductor"),
        contact("gs", "Gema Soto", "Gerente", { phone: "+12025550199" }),
      ];
      data.match = () => ["ana", "gs"];
      renderMenu();
      expect(counters(anaRow()).textContent).toBe("10");
      const gema = screen.getByRole("button", { name: /Gema Soto/ });
      expect(counters(gema).textContent).toBe("00");
    });

    it("passes this case's counts to the call, not the book's", async () => {
      const user = userEvent.setup();
      const onCall = renderMenu(caseB);
      await user.click(anaRow());
      expect(onCall).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: "ana",
          stats: { lastCallAt: null, accepted: 0, denied: 0 },
        })
      );
    });
  });

  it("shows the whole book when the level has no steps", () => {
    renderMenu();
    expect(
      screen.queryByRole("button", { name: /Otros contactos/ })
    ).toBeNull();
    expect(screen.getByRole("button", { name: /Ana Pérez/ })).toBeTruthy();
    expect(screen.getByText("Gema Soto")).toBeTruthy();
    expect(screen.getByText("Marta Díaz")).toBeTruthy();
  });
});

it("distinguishes a pending trip lookup from an empty contact book", () => {
  data.contacts = [];
  data.tripData = {};
  data.match = () => [];
  data.tripLoading = true;
  data.level = levelWith([
    { role: "Conductor", scope: "DRIVER", channel: "call", budgetMinutes: 2 },
  ]);
  renderMenu();
  expect(screen.getByText("Cargando contactos del viaje…")).toBeTruthy();
  expect(
    screen.queryByText("Conductor del viaje no está en la libreta.")
  ).toBeNull();
});

it("shows a trip lookup failure without offering to save an unmatched driver", () => {
  data.contacts = [];
  data.tripData = {};
  data.match = () => [];
  data.tripError = new Error("network failed");
  data.level = levelWith([
    { role: "Conductor", scope: "DRIVER", channel: "call", budgetMinutes: 2 },
  ]);
  renderMenu();
  expect(
    screen.getByText(
      "No se pudieron cargar los contactos del viaje. Inténtalo de nuevo."
    )
  ).toBeTruthy();
  expect(
    screen.queryByText("Conductor del viaje no está en la libreta.")
  ).toBeNull();
});

it("shows a book request failure instead of claiming the trip driver is absent", () => {
  data.contacts = [];
  data.bookError = new Error("book unavailable");
  data.level = levelWith([
    { role: "Conductor", scope: "DRIVER", channel: "call", budgetMinutes: 2 },
  ]);
  renderMenu();
  expect(
    screen.getByText(
      "No se pudieron cargar los contactos del viaje. Inténtalo de nuevo."
    )
  ).toBeTruthy();
  expect(
    screen.queryByText("Conductor del viaje no está en la libreta.")
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Nuevo número" })).toBeNull();
});

it("shows a retry action when the calling order fails to load", async () => {
  data.levelError = { status: 500 };
  const user = userEvent.setup();
  renderMenu();
  expect(screen.getByRole("alert").textContent).toContain(
    "No se pudo cargar el orden de llamadas."
  );
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(data.refreshLevel).toHaveBeenCalledOnce();
});

it("keeps the flat list when no symptom is in force (404)", () => {
  data.levelError = { status: 404 };
  renderMenu();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("Marta Díaz")).toBeTruthy();
});

describe("SLA from the case", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const steps = [
    { role: "Conductor", channel: "call", budgetMinutes: 2 },
    { role: "Jefe de Torre", channel: "call", budgetMinutes: 5 },
  ];
  const ago = (seconds: number) =>
    new Date(Date.now() - seconds * 1000).toISOString();

  it("counts the SLA and the due step from when the case reached its level", () => {
    data.level = levelWith(steps);
    renderMenu({
      ...treatment,
      symptom_info: { ...treatment.symptom_info, sla_since: ago(150) },
    });
    // 10 min SLA, 2:30 at the level: 7:30 left; step 2 ends at 7:00, 4:30 left.
    expect(screen.getByText("SLA 7:30")).toBeTruthy();
    expect(screen.getByText("Paso actual: quedan 4:30")).toBeTruthy();
    const due = document.querySelector('[aria-current="step"]') as HTMLElement;
    expect(within(due).getByText("5 min")).toBeTruthy();
  });

  it("counts again from the end of an ignore hold", () => {
    data.level = levelWith(steps);
    render(
      <CallCenterMenu
        dict={dict}
        treatmentData={
          {
            ...treatment,
            symptom_info: {
              ...treatment.symptom_info,
              sla_since: ago(60),
              returned_after_ignore_at: ago(60),
            },
          } as TreatmentsGeneralResponseItem
        }
        skippedTo={null}
        onSkip={vi.fn()}
        onCall={vi.fn()}
      />
    );
    expect(screen.getByText("SLA 9:00")).toBeTruthy();
  });

  it("says when the case's start is not known instead of counting from the panel", () => {
    data.level = levelWith(steps);
    renderMenu();
    expect(screen.queryByText(/^SLA \d+:\d\d/)).toBeNull();
    expect(screen.getByText("SLA 10 min · sin hora de inicio")).toBeTruthy();
    expect(screen.getByText(es.symptoms.ladder.dueNoStart)).toBeTruthy();
  });
});

describe("skipped steps", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    data.level = levelWith([
      { role: "Conductor", channel: "call", budgetMinutes: 2 },
      { role: "Jefe de Torre", channel: "call", budgetMinutes: 5 },
    ]);
    data.openTreatment.mockResolvedValue({ id: "t-1" });
    data.addTreatmentAction.mockResolvedValue({});
  });
  afterEach(() => vi.useRealTimers());

  const ago = (seconds: number) =>
    new Date(Date.now() - seconds * 1000).toISOString();
  // 30 s at the level: the 2-minute first step is due.
  const atLevel = () =>
    ({
      ...treatment,
      symptom_info: { ...treatment.symptom_info, sla_since: ago(30) },
      trip_info: {
        ...treatment.trip_info,
        asset_id: "AB12",
        trip_id: "trip-1",
      },
    }) as unknown as TreatmentsGeneralResponseItem;
  const dueBudget = () =>
    within(
      document.querySelector('[aria-current="step"]') as HTMLElement
    ).getByText(/min$/).textContent;
  const skipNote = (step: number, performedAt: string) => ({
    id: "t-1",
    status: "OPEN",
    actions: [
      {
        kind: "NOTE",
        note: "No contesta",
        details: { skipToStep: step },
        performedBy: "ops@example.com",
        performedAt,
      },
    ],
  });
  const mount = (onSkip = vi.fn()) =>
    render(
      <CallCenterMenu
        dict={dict}
        treatmentData={atLevel()}
        skippedTo={null}
        onSkip={onSkip}
        onCall={vi.fn()}
      />
    );

  it("saves the skip on the case and keeps it after a reload", async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    data.addTreatmentAction.mockImplementation(async (_id, body) => {
      const saved = {
        ...body,
        performedBy: "ops@example.com",
        performedAt: ago(0),
      };
      data.treatments = [{ id: "t-1", status: "OPEN", actions: [saved] }];
      return saved;
    });
    const onSkip = vi.fn();
    const first = mount(onSkip);
    expect(dueBudget()).toBe("2 min");

    await user.click(screen.getByRole("button", { name: /Saltar paso/ }));
    await user.type(screen.getByLabelText("Por qué se salta"), "No contesta");
    await user.click(screen.getByRole("button", { name: "Saltar" }));

    await waitFor(() => expect(onSkip).toHaveBeenCalledWith(1));
    expect(data.openTreatment).toHaveBeenCalledWith(-7, {
      type: "CALL",
      assetId: "AB12",
      tripId: "trip-1",
    });
    expect(data.addTreatmentAction).toHaveBeenCalledWith("t-1", {
      kind: "NOTE",
      note: "No contesta",
      details: {
        skipToStep: 2,
        level: 3,
        version: 4,
        skipId: expect.any(String),
        slaSince: ago(30),
      },
    });
    expect(data.refreshTreatments).toHaveBeenCalled();

    // A reload: the panel's own state is gone, the case's treatments remain.
    first.unmount();
    mount();
    expect(dueBudget()).toBe("5 min");
    expect(screen.queryByRole("button", { name: /Saltar paso/ })).toBeNull();
  });

  it("ignores a skip made before the case reached its current level", () => {
    data.treatments = [skipNote(2, ago(120))];
    mount();
    expect(dueBudget()).toBe("2 min");
  });

  it("blocks another submission while the skip is being saved", async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    let finishSave = () => {};
    data.addTreatmentAction.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        })
    );
    const onSkip = vi.fn();
    mount(onSkip);
    await user.click(screen.getByRole("button", { name: /Saltar paso/ }));
    await user.type(screen.getByLabelText("Por qué se salta"), "No contesta");
    const confirm = screen.getByRole("button", { name: "Saltar" });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(data.addTreatmentAction).toHaveBeenCalledTimes(1);
    await act(async () => finishSave());
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("keeps the step when the skip cannot be saved", async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    data.addTreatmentAction.mockRejectedValue(new Error("403"));
    const onSkip = vi.fn();
    mount(onSkip);

    await user.click(screen.getByRole("button", { name: /Saltar paso/ }));
    await user.type(screen.getByLabelText("Por qué se salta"), "No contesta");
    await user.click(screen.getByRole("button", { name: "Saltar" }));

    await waitFor(() =>
      expect(ShowNotification).toHaveBeenCalledWith({
        type: "error",
        message: es.symptoms.ladder.skipError,
      })
    );
    expect(onSkip).not.toHaveBeenCalled();
    expect(dueBudget()).toBe("2 min");
    expect(screen.getByLabelText("Por qué se salta")).toHaveValue(
      "No contesta"
    );
    const firstId = data.addTreatmentAction.mock.calls[0]?.[1].details.skipId;
    data.addTreatmentAction.mockResolvedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Saltar" }));
    await waitFor(() => expect(onSkip).toHaveBeenCalledWith(1));
    expect(data.addTreatmentAction.mock.calls[1]?.[1].details.skipId).toBe(
      firstId
    );
  });
});

describe("script blanks", () => {
  it("names a field the case lacks in brackets, never as {{...}}", async () => {
    data.level = levelWith([
      {
        role: "Conductor",
        who: "contact.role == 'Conductor' && contact.nationalId == event.data.driverRut",
        channel: "call",
        budgetMinutes: 2,
        script: "Hola {{trip.driver.name}} te informamos x, y, z",
        goal: "Confirmar {{vehicle.plate}}",
      },
    ]);
    data.context = { case: {}, condition: {}, trip: {}, vehicle: {} };
    const user = userEvent.setup();
    const onCall = renderMenu();
    expect(screen.queryByText(/\{\{/)).toBeNull();
    const blank = screen.getByText("[nombre del conductor]");
    expect(blank.className).toContain("text-amber-700");
    expect(screen.getByText("[patente]")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Ana Pérez/ }));
    expect(onCall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: "Hola [nombre del conductor] te informamos x, y, z",
        goal: "Confirmar [patente]",
        messageParts: [
          { text: "Hola " },
          { blank: "[nombre del conductor]" },
          { text: " te informamos x, y, z" },
        ],
      })
    );
  });
});

describe("contact rows", () => {
  it("gives a callable row a hover state and leaves a row without channels inert", () => {
    data.contacts = [
      contact("ok", "Con canal", "Jefe de Torre"),
      contact("none", "Sin canal", "Jefe de Torre", { methods: [] }),
    ];
    renderMenu();
    const row = screen.getByRole("button", { name: /Con canal/ });
    expect(row.className).toContain("hover:bg-gray-50");
    expect(row.className).toContain("dark:hover:bg-gray-700");
    expect(screen.queryByRole("button", { name: /Sin canal/ })).toBeNull();
    const inert = screen.getByText("Sin canal").closest("div.border-b")!;
    expect(inert.className).not.toContain("hover:");
    expect(
      within(inert as HTMLElement).getByText("Sin canales registrados")
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Editar contacto: Sin canal/ })
    ).toHaveAttribute("href", "/es/users/settings/contact-book?edit=none");
  });
});

describe("trip phone for a driver with no phone", () => {
  const driverStep = levelWith([
    { role: "Conductor", scope: "DRIVER", channel: "call", budgetMinutes: 2 },
  ]);
  const tripWithPhone = {
    ...treatment,
    trip_info: { ...treatment.trip_info, driver_contact: "+56 9 0000 0000" },
  } as unknown as TreatmentsGeneralResponseItem;
  const useTripPhone = "Usar el teléfono del viaje (+56 9 0000 0000)";

  beforeEach(() => {
    data.level = driverStep;
    data.permissions = ["controltower:contact.write"];
    data.contacts = [
      contact("ana", "Ana Pérez", "Conductor", {
        phone: null,
        methods: [],
        channels: null,
        nationalId: "000000019",
      }),
    ];
    data.updateContact.mockImplementation(
      async (id: string, body: Record<string, unknown>) =>
        contact(id, "Ana Pérez", "Conductor", {
          ...body,
          nationalId: "000000019",
        })
    );
  });

  it("saves the trip's number on the contact and calls it", async () => {
    const user = userEvent.setup();
    const onCall = renderMenu(tripWithPhone);
    expect(screen.queryByText("Sin canales registrados")).toBeNull();
    expect(onCall).not.toHaveBeenCalled();
    expect(data.updateContact).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: useTripPhone }));
    await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    expect(data.updateContact).toHaveBeenCalledWith("ana", {
      phone: "+56900000000",
      methods: ["PHONE", "WHATSAPP"],
      channels: { phone: "+56900000000", whatsapp: "+56900000000" },
    });
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "ana",
        phone: "+56 9 0000 0000",
        methods: ["phone", "whatsapp"],
      })
    );
    expect(vi.mocked(mutate).mock.calls).toEqual([
      ["contacts"],
      ["contact-facets"],
      ["contact-reach"],
    ]);
  });

  it("waits for the save before dialing and supports keyboard activation", async () => {
    let finishSave = () => {};
    data.updateContact.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () =>
            resolve(
              contact("ana", "Ana Pérez", "Conductor", {
                phone: "+56900000000",
                methods: ["PHONE", "WHATSAPP"],
              })
            );
        })
    );
    const user = userEvent.setup();
    const onCall = renderMenu(tripWithPhone);
    const button = screen.getByRole("button", { name: useTripPhone });
    button.focus();
    await user.keyboard("{Enter}");
    expect(data.updateContact).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(onCall).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    await act(async () => finishSave());
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it("keeps a newer call selection when the trip phone save finishes", async () => {
    let finishSave = () => {};
    data.updateContact.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () =>
            resolve(
              contact("ana", "Ana Pérez", "Conductor", {
                phone: "+56900000000",
              })
            );
        })
    );
    const user = userEvent.setup();
    const onCall = renderMenu(tripWithPhone);
    await user.click(screen.getByRole("button", { name: useTripPhone }));
    await user.click(
      screen.getByRole("button", { name: "Llamar a Carabineros (133)" })
    );
    await act(async () => finishSave());
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ personName: "Carabineros", phone: "133" })
    );
  });

  it("does not substitute the trip phone when an existing channel is selected", async () => {
    data.contacts = [
      contact("ana", "Ana Pérez", "Conductor", {
        phone: null,
        methods: ["TEAMS"],
        channels: { teams: "ana@example.com" },
        nationalId: "000000019",
      }),
    ];
    const onCall = renderMenu(tripWithPhone);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Llamar Ana Pérez" }));
    expect(data.updateContact).not.toHaveBeenCalled();
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "", methods: ["teams"] })
    );
  });

  it("keeps the contact's other channels", async () => {
    data.contacts = [
      contact("ana", "Ana Pérez", "Conductor", {
        phone: null,
        methods: ["TEAMS"],
        channels: { teams: "ana@example.com" },
        nationalId: "000000019",
      }),
    ];
    const user = userEvent.setup();
    renderMenu(tripWithPhone);
    await user.click(screen.getByRole("button", { name: useTripPhone }));
    await waitFor(() =>
      expect(data.updateContact).toHaveBeenCalledWith("ana", {
        phone: "+56900000000",
        methods: ["TEAMS", "PHONE", "WHATSAPP"],
        channels: {
          teams: "ana@example.com",
          phone: "+56900000000",
          whatsapp: "+56900000000",
        },
      })
    );
  });

  it("shows the error and keeps the row when the update fails", async () => {
    data.updateContact.mockRejectedValueOnce(new Error("HTTP 500"));
    const { ShowNotification } =
      await import("@/features/notifications/notification");
    const user = userEvent.setup();
    const onCall = renderMenu(tripWithPhone);
    await user.click(screen.getByRole("button", { name: useTripPhone }));
    await waitFor(() =>
      expect(ShowNotification).toHaveBeenCalledWith({
        type: "error",
        message: es.symptoms.call_center_trip_phone_error,
      })
    );
    expect(onCall).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: useTripPhone })
    ).not.toBeDisabled();
  });

  it("shows the trip's number as a link to a user who cannot edit contacts", () => {
    data.permissions = [];
    renderMenu(tripWithPhone);
    expect(screen.queryByRole("button", { name: useTripPhone })).toBeNull();
    expect(
      screen.getByRole("link", { name: "+56 9 0000 0000" })
    ).toHaveAttribute("href", "tel:+56900000000");
    expect(data.updateContact).not.toHaveBeenCalled();
  });

  it("is not offered when the trip has no phone", () => {
    renderMenu({
      ...treatment,
      trip_info: { ...treatment.trip_info, driver_contact: "" },
    } as unknown as TreatmentsGeneralResponseItem);
    expect(screen.queryByText(/Usar el teléfono del viaje/)).toBeNull();
    expect(screen.getByText("Sin canales registrados")).toBeTruthy();
  });

  it("is not offered when the contact already has a phone", () => {
    data.contacts = [
      contact("ana", "Ana Pérez", "Conductor", { nationalId: "000000019" }),
    ];
    renderMenu(tripWithPhone);
    expect(screen.queryByText(/Usar el teléfono del viaje/)).toBeNull();
  });

  it("is not offered when the trip phone is invalid", () => {
    renderMenu({
      ...treatment,
      trip_info: { ...treatment.trip_info, driver_contact: "123" },
    } as unknown as TreatmentsGeneralResponseItem);
    expect(screen.queryByText(/Usar el teléfono del viaje/)).toBeNull();
    expect(screen.queryByRole("link", { name: "123" })).toBeNull();
    expect(data.updateContact).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "does not offer the trip phone under other contacts (write access: %s)",
    async (canWrite) => {
      data.permissions = canWrite ? ["controltower:contact.write"] : [];
      data.match = () => [];
      renderMenu(tripWithPhone);
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: /Otros contactos/ }));
      expect(screen.getByText("Ana Pérez")).toBeTruthy();
      expect(screen.queryByText(/Usar el teléfono del viaje/)).toBeNull();
      expect(
        screen.queryByRole("link", { name: "+56 9 0000 0000" })
      ).toBeNull();
    }
  );

  it("is not offered for a matched contact that is not the trip driver", () => {
    data.contacts = [
      contact("ana", "Ana Pérez", "Conductor", {
        phone: null,
        methods: [],
        channels: null,
        nationalId: "000000027",
      }),
    ];
    renderMenu(tripWithPhone);
    expect(screen.queryByText(/Usar el teléfono del viaje/)).toBeNull();
    expect(screen.getByText("Sin canales registrados")).toBeTruthy();
  });
});

describe("emergency numbers", () => {
  it("shows Chile's numbers and calls one as an emergency contact", async () => {
    data.level = levelWith([
      { role: "Conductor", channel: "call", budgetMinutes: 2 },
    ]);
    const onCall = renderMenu();
    for (const [name, number] of [
      ["Carabineros", "133"],
      ["Ambulancia (SAMU)", "131"],
      ["Bomberos", "132"],
      ["PDI", "134"],
    ])
      expect(
        screen.getByRole("button", {
          name: `Llamar a ${name} (${number})`,
        })
      ).toBeTruthy();
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: "Llamar a Carabineros (133)" })
      );
    expect(onCall).toHaveBeenCalledWith({
      id: "emergency:CL:133",
      personName: "Carabineros",
      role: "Emergencias – Carabineros",
      phone: "133",
      channels: { phone: "133" },
      methods: ["phone"],
      stats: null,
    });
  });
});

describe("panel scroll", () => {
  it("scrolls the info, steps and other contacts in one area, with emergency numbers pinned outside it", async () => {
    data.level = levelWith([
      { role: "Conductor", channel: "call", budgetMinutes: 2 },
    ]);
    renderMenu();
    const scroll = screen.getByTestId("call-center-scroll");
    expect(scroll.className).toMatch(/\bmin-h-0\b/);
    expect(scroll.className).toMatch(/\bflex-1\b/);
    expect(scroll.className).toMatch(/\boverflow-y-auto\b/);
    expect(
      within(scroll).getByText(es.symptoms.proto_section_general)
    ).toBeTruthy();
    expect(
      within(scroll).getByText(es.symptoms.proto_section_who)
    ).toBeTruthy();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Otros contactos/ }));
    const search = screen.getByPlaceholderText(
      es.symptoms.call_center_other_search_placeholder
    );
    expect(scroll.contains(search)).toBe(true);
    expect(search.closest(".sticky")).toBeTruthy();

    const emergency = screen.getByRole("button", {
      name: "Llamar a Carabineros (133)",
    });
    expect(scroll.contains(emergency)).toBe(false);
  });

  it("renders other contacts a page at a time", async () => {
    data.contacts = Array.from({ length: 120 }, (_, i) =>
      contact(`c${i}`, `Contacto ${String(i).padStart(3, "0")}`, "Operador")
    );
    data.match = () => [];
    data.level = levelWith([
      { role: "Conductor", channel: "call", budgetMinutes: 2 },
    ]);
    renderMenu();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Otros contactos (120)" })
    );
    expect(screen.getByText("Contacto 049")).toBeTruthy();
    expect(screen.queryByText("Contacto 050")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ver más (70)" }));
    expect(screen.getByText("Contacto 099")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ver más (20)" }));
    expect(screen.getByText("Contacto 119")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ver más/ })).toBeNull();

    await user.type(
      screen.getByPlaceholderText(
        es.symptoms.call_center_other_search_placeholder
      ),
      "Contacto 11"
    );
    expect(screen.getByText("Contacto 115")).toBeTruthy();
  });
});

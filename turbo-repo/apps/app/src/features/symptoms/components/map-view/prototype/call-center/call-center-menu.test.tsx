import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import CallCenterMenu from "./call-center-menu";

const data = vi.hoisted(() => ({
  contacts: [] as unknown[],
  treatments: undefined as unknown,
  tripData: {} as Record<string, string>,
  /** The server's answer for one step condition. */
  match: (() => []) as (condition: string) => string[],
  level: undefined as unknown,
  treatmentsId: undefined as unknown,
  createContact: vi.fn(),
  refreshTrip: vi.fn(),
}));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  createContact: data.createContact,
  contactsKey: "contacts",
  useContacts: () => ({ data: data.contacts, isLoading: false }),
  useSymptomTreatments: (id: unknown) => {
    data.treatmentsId = id;
    return { data: data.treatments };
  },
  useTripContacts: (_id: unknown, conditions: string[]) => ({
    mutate: data.refreshTrip,
    data: {
      data: data.tripData,
      matches: conditions.map((c) => data.match(c)),
      problems: conditions.map(() => null),
    },
  }),
}));

vi.mock("swr", () => ({ mutate: vi.fn() }));

vi.mock("@/features/symptoms/maintainer/maintainer-api", () => ({
  useLevelResponse: () => ({ data: data.level }),
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

function renderMenu() {
  const onCall = vi.fn();
  render(
    <CallCenterMenu
      dict={dict}
      treatmentData={treatment}
      startedAt={Date.now()}
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
    if (c.includes("Gerente de Seguridad")) return ["gs"];
    if (c.includes("Jefe de Torre")) return ["torre"];
    return [];
  };
  data.treatments = undefined;
  data.level = undefined;
  data.createContact.mockImplementation(
    async (body: Record<string, unknown>) => ({ ...body, id: "new-contact" })
  );
});

describe("CallCenterMenu", () => {
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
    const onCall = renderMenu();

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
        stats: expect.objectContaining({ accepted: 2, denied: 1 }),
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
    await saveNewNumber(user, "Ana Nueva");

    expect(data.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ana Nueva",
        role: "Conductor",
        nationalId: "000000019",
      })
    );
    expect(data.refreshTrip).toHaveBeenCalled();
    await waitFor(() =>
      expect(onCall).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "new-contact" })
      )
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

  it("marks who was already called in this case, including older driver calls", () => {
    data.level = levelWith([
      { role: "Conductor", channel: "call", budgetMinutes: 2, script: null },
    ]);
    data.treatments = [
      {
        actions: [
          {
            kind: "CALL",
            contactId: null,
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
